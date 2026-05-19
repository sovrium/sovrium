/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import ReactPDF from '@react-pdf/renderer'
import React from 'react'

const { Document, Page, Text, View, StyleSheet, renderToBuffer } = ReactPDF

const styles = StyleSheet.create({
  page: {
    padding: 30,
    fontSize: 12,
    fontFamily: 'Helvetica',
  },
  title: {
    fontSize: 18,
    marginBottom: 20,
    fontWeight: 'bold',
  },
  table: {
    width: '100%',
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    paddingVertical: 4,
  },
  tableHeader: {
    flexDirection: 'row',
    borderBottomWidth: 2,
    borderBottomColor: '#111827',
    paddingVertical: 6,
    fontWeight: 'bold',
  },
  tableCell: {
    flex: 1,
    paddingHorizontal: 4,
  },
})

export interface PdfExportOptions {
  readonly title: string
  readonly columns: readonly string[]
  readonly rows: readonly (readonly string[])[]
}

export const exportToPdf = async (options: PdfExportOptions): Promise<Uint8Array> => {
  const doc = React.createElement(
    Document,
    undefined,
    React.createElement(
      Page,
      { size: 'A4', style: styles.page },
      React.createElement(Text, { style: styles.title }, options.title),
      React.createElement(
        View,
        { style: styles.table },
        React.createElement(
          View,
          { style: styles.tableHeader },
          ...options.columns.map((col, i) =>
            React.createElement(Text, { key: `h-${String(i)}`, style: styles.tableCell }, col)
          )
        ),
        ...options.rows.map((row, ri) =>
          React.createElement(
            View,
            { key: `r-${String(ri)}`, style: styles.tableRow },
            ...row.map((cell, ci) =>
              React.createElement(
                Text,
                { key: `c-${String(ri)}-${String(ci)}`, style: styles.tableCell },
                String(cell)
              )
            )
          )
        )
      )
    )
  )

  const buffer = await renderToBuffer(doc)
  return new Uint8Array(buffer)
}
