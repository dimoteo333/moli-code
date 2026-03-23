/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useState } from 'react';

/**
 * Returns the actual terminal size without any padding adjustments.
 * Components should handle their own margins/padding as needed.
 */
export function useTerminalSize(): { columns: number; rows: number } {
  const [size, setSize] = useState({
    columns: process.stdout.columns || 80,
    rows: process.stdout.rows || 24,
  });

  useEffect(() => {
    function updateSize() {
      const newColumns = process.stdout.columns || 80;
      const newRows = process.stdout.rows || 24;
      setSize((prev) => {
        if (prev.columns === newColumns && prev.rows === newRows) return prev;
        return { columns: newColumns, rows: newRows };
      });
    }

    process.stdout.on('resize', updateSize);
    return () => {
      process.stdout.off('resize', updateSize);
    };
  }, []);

  return size;
}
