#!/usr/bin/env python3
"""PDF to Excel conversion script using pdfplumber + openpyxl."""

import sys
import os

def convert_pdf_to_excel(input_path, output_path):
    try:
        import pdfplumber
        from openpyxl import Workbook
        
        wb = Workbook()
        ws = wb.active
        ws.title = "Extracted Data"
        
        total_rows = 0
        
        with pdfplumber.open(input_path) as pdf:
            total_pages = len(pdf.pages)
            
            for page_num, page in enumerate(pdf.pages):
                # Try to extract tables first
                tables = page.extract_tables()
                
                if tables:
                    for table in tables:
                        if not table:
                            continue
                        
                        # Add a page separator row
                        if total_rows > 0:
                            total_rows += 1
                        
                        for row in table:
                            if row:
                                # Replace None with empty string
                                cleaned_row = [str(cell) if cell is not None else '' for cell in row]
                                ws.append(cleaned_row)
                                total_rows += 1
                else:
                    # No tables found — extract text and put it line by line
                    text = page.extract_text()
                    if text:
                        if total_rows > 0:
                            total_rows += 1
                        
                        for line in text.split('\n'):
                            # Split by multiple spaces to create columns
                            columns = [col.strip() for col in line.split('  ') if col.strip()]
                            if columns:
                                ws.append(columns)
                                total_rows += 1
                            elif line.strip():
                                ws.append([line.strip()])
                                total_rows += 1
        
        if total_rows == 0:
            # Try extracting all text as a fallback
            with pdfplumber.open(input_path) as pdf:
                for page in pdf.pages:
                    text = page.extract_text()
                    if text:
                        for line in text.split('\n'):
                            ws.append([line])
                            total_rows += 1
        
        if total_rows == 0:
            print("WARNING: No data extracted from PDF")
            # Still save an empty workbook
            ws.append(["No data could be extracted from this PDF"])
        
        # Auto-adjust column widths
        for col in ws.columns:
            max_length = 0
            column_letter = col[0].column_letter
            for cell in col:
                try:
                    if cell.value:
                        max_length = max(max_length, len(str(cell.value)))
                except:
                    pass
            adjusted_width = min(max_length + 2, 50)
            ws.column_dimensions[column_letter].width = adjusted_width
        
        wb.save(output_path)
        
        if os.path.exists(output_path) and os.path.getsize(output_path) > 0:
            print(f"SUCCESS: {output_path} ({total_rows} rows)")
            sys.exit(0)
        else:
            print("ERROR: Output file not created or empty")
            sys.exit(1)
            
    except Exception as e:
        print(f"ERROR: {str(e)}")
        sys.exit(1)

if __name__ == "__main__":
    if len(sys.argv) != 3:
        print("Usage: convert_to_excel.py <input_pdf> <output_xlsx>")
        sys.exit(1)
    
    input_path = sys.argv[1]
    output_path = sys.argv[2]
    
    if not os.path.exists(input_path):
        print(f"ERROR: Input file not found: {input_path}")
        sys.exit(1)
    
    convert_pdf_to_excel(input_path, output_path)
