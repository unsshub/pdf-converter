#!/usr/bin/env python3
"""PDF to DOCX conversion script using pdf2docx."""

import sys
import os

def convert_pdf_to_docx(input_path, output_path):
    try:
        from pdf2docx import Converter
        
        cv = Converter(input_path)
        cv.convert(output_path)
        cv.close()
        
        if os.path.exists(output_path) and os.path.getsize(output_path) > 0:
            print(f"SUCCESS: {output_path}")
            sys.exit(0)
        else:
            print(f"ERROR: Output file not created or empty")
            sys.exit(1)
    except Exception as e:
        print(f"ERROR: {str(e)}")
        sys.exit(1)

if __name__ == "__main__":
    if len(sys.argv) != 3:
        print("Usage: convert.py <input_pdf> <output_docx>")
        sys.exit(1)
    
    input_path = sys.argv[1]
    output_path = sys.argv[2]
    
    if not os.path.exists(input_path):
        print(f"ERROR: Input file not found: {input_path}")
        sys.exit(1)
    
    convert_pdf_to_docx(input_path, output_path)
