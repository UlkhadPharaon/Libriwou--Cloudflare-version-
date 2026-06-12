import { 
    Document, 
    Packer, 
    Paragraph, 
    TextRun, 
    Table, 
    TableRow, 
    TableCell, 
    WidthType, 
    BorderStyle, 
    AlignmentType,
    HeadingLevel,
    Header,
    Footer,
    HorizontalPositionRelativeFrom,
    VerticalPositionRelativeFrom,
    HeightRule
} from 'docx';
import { saveAs } from 'file-saver';

export async function generateInvoiceDOCX(data: {
    company: any,
    client: {
        name: string,
        ifu: string,
        rccm: string,
        address: string,
        email: string,
        phone: string
    },
    invoiceType: string,
    invoiceNum: string,
    date: string,
    elements: any[],
    totals: {
        ht: number,
        tva: number,
        ttc: number,
        tvaRate: number
    },
    terms: {
        dueDate: string,
        paymentMethod: string
    }
}) {
    const { company, client, invoiceType, invoiceNum, date, elements, totals, terms } = data;

    const doc = new Document({
        sections: [{
            headers: {
                default: new Header({
                    children: [
                        new Paragraph({
                            alignment: AlignmentType.RIGHT,
                            children: [
                                new TextRun({
                                    text: invoiceType === 'PROFORMA' ? "FACTURE PROFORMA" : "FACTURE",
                                    bold: true,
                                    size: 32,
                                    color: "1E1E1E",
                                }),
                            ],
                        }),
                    ],
                }),
            },
            footers: {
                default: new Footer({
                    children: [
                        new Paragraph({
                            alignment: AlignmentType.CENTER,
                            children: [
                                new TextRun({
                                    text: `Document généré par NeoCompta - ${company?.companyName || 'Mon Entreprise'}`,
                                    size: 16,
                                    color: "888888",
                                }),
                            ],
                        }),
                        new Paragraph({
                            alignment: AlignmentType.CENTER,
                            children: [
                                new TextRun({
                                    text: "Conformité SYSCOHADA & DGI Burkina Faso",
                                    size: 14,
                                    color: "888888",
                                    italics: true,
                                }),
                            ],
                        }),
                    ],
                }),
            },
            children: [
                // Sender & Receiver block
                new Table({
                    width: { size: 100, type: WidthType.PERCENTAGE },
                    borders: {
                        top: { style: BorderStyle.NONE },
                        bottom: { style: BorderStyle.NONE },
                        left: { style: BorderStyle.NONE },
                        right: { style: BorderStyle.NONE },
                        insideHorizontal: { style: BorderStyle.NONE },
                        insideVertical: { style: BorderStyle.NONE },
                    },
                    rows: [
                        new TableRow({
                            children: [
                                new TableCell({
                                    width: { size: 50, type: WidthType.PERCENTAGE },
                                    children: [
                                        new Paragraph({ children: [new TextRun({ text: "ÉMETTEUR :", bold: true, size: 20 })] }),
                                        new Paragraph({ children: [new TextRun({ text: company?.companyName || "Mon Entreprise", bold: true })] }),
                                        new Paragraph({ children: [new TextRun({ text: `IFU : ${company?.ifu || '-'}` })] }),
                                        new Paragraph({ children: [new TextRun({ text: `RCCM : ${company?.rccm || '-'}` })] }),
                                        new Paragraph({ children: [new TextRun({ text: company?.address || '-' })] }),
                                        new Paragraph({ children: [new TextRun({ text: company?.email || '-' })] }),
                                    ],
                                }),
                                new TableCell({
                                    width: { size: 50, type: WidthType.PERCENTAGE },
                                    children: [
                                        new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: "CLIENT (DOIT) :", bold: true, size: 20 })] }),
                                        new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: client.name, bold: true })] }),
                                        new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: `IFU : ${client.ifu || '-'}` })] }),
                                        new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: `RCCM : ${client.rccm || '-'}` })] }),
                                        new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: client.address || '-' })] }),
                                        new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: client.phone || '-' })] }),
                                    ],
                                }),
                            ],
                        }),
                    ],
                }),

                new Paragraph({ text: "", spacing: { before: 400, after: 400 } }),

                new Paragraph({
                    children: [
                        new TextRun({ text: `Numéro : `, bold: true }),
                        new TextRun({ text: invoiceType === 'PROFORMA' ? '(PROFORMA)' : invoiceNum }),
                    ],
                }),
                new Paragraph({
                    children: [
                        new TextRun({ text: `Date : `, bold: true }),
                        new TextRun({ text: date }),
                    ],
                }),

                new Paragraph({ text: "", spacing: { before: 400, after: 400 } }),

                // Items Table
                new Table({
                    width: { size: 100, type: WidthType.PERCENTAGE },
                    rows: [
                        new TableRow({
                            tableHeader: true,
                            children: [
                                new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Description", bold: true })] })], shading: { fill: "F2F2F2" } }),
                                new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Qté", bold: true })], alignment: AlignmentType.CENTER })], shading: { fill: "F2F2F2" } }),
                                new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "P.U (HT)", bold: true })], alignment: AlignmentType.CENTER })], shading: { fill: "F2F2F2" } }),
                                new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Remise", bold: true })], alignment: AlignmentType.CENTER })], shading: { fill: "F2F2F2" } }),
                                new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Total HT", bold: true })], alignment: AlignmentType.CENTER })], shading: { fill: "F2F2F2" } }),
                            ],
                        }),
                        ...elements.map(el => {
                            const base = el.quantity * el.unitPrice;
                            const totalLinesHT = base - (base * ((el.discount || 0) / 100));
                            return new TableRow({
                                children: [
                                    new TableCell({ children: [new Paragraph(el.description)] }),
                                    new TableCell({ children: [new Paragraph({ text: el.quantity.toString(), alignment: AlignmentType.CENTER })] }),
                                    new TableCell({ children: [new Paragraph({ text: el.unitPrice.toLocaleString('fr-BF') + " FCFA", alignment: AlignmentType.RIGHT })] }),
                                    new TableCell({ children: [new Paragraph({ text: el.discount ? el.discount + "%" : "-", alignment: AlignmentType.CENTER })] }),
                                    new TableCell({ children: [new Paragraph({ text: totalLinesHT.toLocaleString('fr-BF') + " FCFA", alignment: AlignmentType.RIGHT })] }),
                                ],
                            });
                        }),
                    ],
                }),

                new Paragraph({ text: "", spacing: { before: 400, after: 400 } }),

                // Totals
                new Table({
                    width: { size: 100, type: WidthType.PERCENTAGE },
                    borders: {
                        top: { style: BorderStyle.NONE },
                        bottom: { style: BorderStyle.NONE },
                        left: { style: BorderStyle.NONE },
                        right: { style: BorderStyle.NONE },
                        insideHorizontal: { style: BorderStyle.NONE },
                        insideVertical: { style: BorderStyle.NONE },
                    },
                    rows: [
                        new TableRow({
                            children: [
                                new TableCell({ width: { size: 60, type: WidthType.PERCENTAGE }, children: [] }),
                                new TableCell({
                                    width: { size: 40, type: WidthType.PERCENTAGE },
                                    children: [
                                        new Paragraph({ 
                                            alignment: AlignmentType.RIGHT,
                                            children: [
                                                new TextRun({ text: "TOTAL HT : ", bold: true }),
                                                new TextRun({ text: totals.ht.toLocaleString('fr-BF') + " FCFA" })
                                            ]
                                        }),
                                        ...(totals.tva > 0 ? [
                                            new Paragraph({ 
                                                alignment: AlignmentType.RIGHT,
                                                children: [
                                                    new TextRun({ text: `TVA (${totals.tvaRate * 100}%) : `, bold: true }),
                                                    new TextRun({ text: totals.tva.toLocaleString('fr-BF') + " FCFA" })
                                                ]
                                            })
                                        ] : []),
                                        new Paragraph({ 
                                            alignment: AlignmentType.RIGHT,
                                            spacing: { before: 200 },
                                            children: [
                                                new TextRun({ text: "TOTAL TTC : ", bold: true, size: 24 }),
                                                new TextRun({ text: totals.ttc.toLocaleString('fr-BF') + " FCFA", bold: true, size: 24, color: "2563EB" })
                                            ]
                                        }),
                                    ],
                                }),
                            ],
                        }),
                    ],
                }),

                new Paragraph({ text: "", spacing: { before: 400, after: 400 } }),

                new Paragraph({
                    children: [
                        new TextRun({ text: "MODALITÉS DE PAIEMENT", bold: true, size: 20 }),
                    ],
                }),
                new Paragraph({
                    children: [
                        new TextRun({ text: `Échéance : `, bold: true }),
                        new TextRun({ text: terms.dueDate || 'À réception' }),
                    ],
                }),
                new Paragraph({
                    children: [
                        new TextRun({ text: `Mode : `, bold: true }),
                        new TextRun({ text: terms.paymentMethod || 'Non spécifié' }),
                    ],
                }),
            ],
        }],
    });

    const blob = await Packer.toBlob(doc);
    saveAs(blob, `${invoiceType}_${client.name.replace(/\s+/g, '_')}_${new Date().getFullYear()}.docx`);
}

export async function generatePayrollSlipDOCX(data: {
    company: any,
    employee: {
        name: string,
        role: string
    },
    calc: any,
    period: string
}) {
    const { company, employee, calc, period } = data;

    const doc = new Document({
        sections: [{
            children: [
                new Paragraph({
                    alignment: AlignmentType.CENTER,
                    heading: HeadingLevel.HEADING_1,
                    children: [new TextRun({ text: "BULLETIN DE PAIE", bold: true, size: 36 })]
                }),
                new Paragraph({
                    alignment: AlignmentType.CENTER,
                    children: [new TextRun({ text: `PÉRIODE : ${period}`, size: 20, italics: true })]
                }),

                new Paragraph({ text: "", spacing: { before: 400, after: 400 } }),

                new Table({
                    width: { size: 100, type: WidthType.PERCENTAGE },
                    borders: {
                        top: { style: BorderStyle.NONE },
                        bottom: { style: BorderStyle.NONE },
                        left: { style: BorderStyle.NONE },
                        right: { style: BorderStyle.NONE },
                        insideHorizontal: { style: BorderStyle.NONE },
                        insideVertical: { style: BorderStyle.NONE },
                    },
                    rows: [
                        new TableRow({
                            children: [
                                new TableCell({
                                    width: { size: 50, type: WidthType.PERCENTAGE },
                                    children: [
                                        new Paragraph({ children: [new TextRun({ text: "EMPLOYEUR :", bold: true })] }),
                                        new Paragraph(company?.companyName || "Mon Entreprise"),
                                        new Paragraph(`IFU : ${company?.ifu || '-'}`),
                                        new Paragraph(company?.address || '-'),
                                    ],
                                }),
                                new TableCell({
                                    width: { size: 50, type: WidthType.PERCENTAGE },
                                    children: [
                                        new Paragraph({ children: [new TextRun({ text: "SALARIÉ :", bold: true })] }),
                                        new Paragraph(employee.name),
                                        new Paragraph(`Poste : ${employee.role}`),
                                    ],
                                }),
                            ],
                        }),
                    ],
                }),

                new Paragraph({ text: "", spacing: { before: 400, after: 400 } }),

                new Table({
                    width: { size: 100, type: WidthType.PERCENTAGE },
                    rows: [
                        new TableRow({
                            children: [
                                new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Libellé", bold: true })] })], shading: { fill: "F2F2F2" } }),
                                new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Base / Taux", bold: true })], alignment: AlignmentType.CENTER })], shading: { fill: "F2F2F2" } }),
                                new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Retenue", bold: true })], alignment: AlignmentType.CENTER })], shading: { fill: "F2F2F2" } }),
                                new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Gain", bold: true })], alignment: AlignmentType.CENTER })], shading: { fill: "F2F2F2" } }),
                            ],
                        }),
                        new TableRow({
                            children: [
                                new TableCell({ children: [new Paragraph("Salaire de base (Brut)")] }),
                                new TableCell({ children: [new Paragraph({ text: "100%", alignment: AlignmentType.CENTER })] }),
                                new TableCell({ children: [new Paragraph("")] }),
                                new TableCell({ children: [new Paragraph({ text: calc.grossSalary.toLocaleString('fr-BF') + " FCFA", alignment: AlignmentType.RIGHT })] }),
                            ],
                        }),
                        new TableRow({
                            children: [
                                new TableCell({ children: [new Paragraph("CNSS Salarié")] }),
                                new TableCell({ children: [new Paragraph({ text: "5.5%", alignment: AlignmentType.CENTER })] }),
                                new TableCell({ children: [new Paragraph({ text: Math.round(calc.cnssEmployee).toLocaleString('fr-BF') + " FCFA", alignment: AlignmentType.RIGHT })] }),
                                new TableCell({ children: [new Paragraph("")] }),
                            ],
                        }),
                        new TableRow({
                            children: [
                                new TableCell({ children: [new Paragraph("IUTS (Impôt sur le Revenu)")] }),
                                new TableCell({ children: [new Paragraph({ text: "Barème progressif", alignment: AlignmentType.CENTER })] }),
                                new TableCell({ children: [new Paragraph({ text: Math.round(calc.iuts).toLocaleString('fr-BF') + " FCFA", alignment: AlignmentType.RIGHT })] }),
                                new TableCell({ children: [new Paragraph("")] }),
                            ],
                        }),
                    ],
                }),

                new Paragraph({ text: "", spacing: { before: 400, after: 400 } }),

                new Table({
                    width: { size: 100, type: WidthType.PERCENTAGE },
                    borders: {
                        top: { style: BorderStyle.NONE },
                        bottom: { style: BorderStyle.NONE },
                        left: { style: BorderStyle.NONE },
                        right: { style: BorderStyle.NONE },
                        insideHorizontal: { style: BorderStyle.NONE },
                        insideVertical: { style: BorderStyle.NONE },
                    },
                    rows: [
                        new TableRow({
                            children: [
                                new TableCell({ width: { size: 60, type: WidthType.PERCENTAGE }, children: [] }),
                                new TableCell({
                                    width: { size: 40, type: WidthType.PERCENTAGE },
                                    children: [
                                        new Paragraph({ 
                                            alignment: AlignmentType.RIGHT,
                                            spacing: { before: 200 },
                                            children: [
                                                new TextRun({ text: "NET À PAYER : ", bold: true, size: 28 }),
                                                new TextRun({ text: Math.round(calc.netSalary).toLocaleString('fr-BF') + " FCFA", bold: true, size: 28, color: "10B981" })
                                            ]
                                        }),
                                    ],
                                }),
                            ],
                        }),
                    ],
                }),

                new Paragraph({ text: "", spacing: { before: 600 } }),
                new Table({
                    width: { size: 100, type: WidthType.PERCENTAGE },
                    borders: {
                        top: { style: BorderStyle.NONE },
                        bottom: { style: BorderStyle.NONE },
                        left: { style: BorderStyle.NONE },
                        right: { style: BorderStyle.NONE },
                        insideHorizontal: { style: BorderStyle.NONE },
                        insideVertical: { style: BorderStyle.NONE },
                    },
                    rows: [
                        new TableRow({
                            children: [
                                new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "SIGNATURE EMPLOYEUR", bold: true })], alignment: AlignmentType.CENTER })] }),
                                new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "SIGNATURE SALARIÉ", bold: true })], alignment: AlignmentType.CENTER })] }),
                            ]
                        })
                    ]
                })
            ],
        }],
    });

    const blob = await Packer.toBlob(doc);
    saveAs(blob, `Bulletin_Paie_${employee.name.replace(/\s+/g, '_')}_${period.replace(/\s+/g, '_')}.docx`);
}
