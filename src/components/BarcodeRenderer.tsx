/**
 * BarcodeRenderer component using JsBarcode
 */
import React, { useEffect, useRef } from 'react';
import JsBarcode from 'jsbarcode';

interface BarcodeRendererProps {
  value: string;
  width?: number;
  height?: number;
  displayValue?: boolean;
}

export const BarcodeRenderer: React.FC<BarcodeRendererProps> = ({
  value,
  width = 2,
  height = 50,
  displayValue = true,
}) => {
  const svgRef = useRef<SVGSVGElement | null>(null);

  useEffect(() => {
    if (svgRef.current && value) {
      try {
        JsBarcode(svgRef.current, value, {
          format: 'CODE128',
          width,
          height,
          displayValue,
          fontSize: 14,
          margin: 5,
        });
      } catch (err) {
        console.error('Barcode generation error:', err);
      }
    }
  }, [value, width, height, displayValue]);

  return <svg ref={svgRef} className="max-w-full h-auto" />;
};
