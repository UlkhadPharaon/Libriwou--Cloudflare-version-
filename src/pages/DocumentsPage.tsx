import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { doc, onSnapshot } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { localDb } from '../services/localDb';
import { FileText, Download } from 'lucide-react';
import { Document, Packer, Paragraph, TextRun } from 'docx';
import { saveAs } from 'file-saver';

export function DocumentsPage() {
  const [company, setCompany] = useState<any>(null);

  useEffect(() => {
    const user = auth.currentUser;
    if (user) {
      const unsub = localDb.subscribe('companies', user.uid, (list) => {
        if (list.length > 0) setCompany(list[0] as any);
        else {
          import('firebase/firestore').then(({ doc: fdoc, getDoc }) => {
            getDoc(fdoc(db, 'companies', user.uid)).then(s => { if (s.exists()) setCompany(s.data() as any); });
          });
        }
      });
      return () => unsub();
    }
    const unsubAuth = auth.onAuthStateChanged((u) => {
      if (!u) return;
      const unsub = localDb.subscribe('companies', u.uid, (list) => {
        if (list.length > 0) setCompany(list[0] as any);
      });
      return () => unsub();
    });
    return () => unsubAuth();
  }, []);

  const generateDocument = async (docInfo: any) => {
    const doc = new Document({
      sections: [{
        children: [
          new Paragraph({
            children: [
              new TextRun({ text: `Document Fiscal: ${docInfo.name}`, bold: true, size: 32 }),
            ],
          }),
          new Paragraph({
            children: [
              new TextRun({ text: `Entreprise: ${company.companyName}` }),
            ],
          }),
          new Paragraph({
            children: [
              new TextRun({ text: `IFU: ${company.ifu}` }),
            ],
          }),
          new Paragraph({
            children: [
              new TextRun({ text: `Régime Fiscal: ${company.taxRegime}` }),
            ],
          }),
        ],
      }],
    });

    const blob = await Packer.toBlob(doc);
    saveAs(blob, `${docInfo.id}_${company.companyName}.docx`);
  };

const getDocuments = () => {
    if (!company) return [];
    const regime = company.taxRegime;
    const docs = [
      { id: 'declaration_tva', name: 'Proforma Déclaration TVA (G50)', description: 'Données de déclaration mensuelle de la TVA (à reporter sur e-SINTAX).', regime: ['RSI', 'RNI'] },
      { id: 'liasse_smt', name: 'Liasse Fiscale Annuelle (SMT)', description: 'Système Minimal de Trésorerie (Bilan et CR simplifiés).', regime: ['RSI'] },
      { id: 'liasse_syscohada', name: 'Liasse Fiscale Annuelle (SYSCOHADA complet)', description: '4 états de synthèse + 36 notes annexes.', regime: ['RNI'] },
      { id: 'declaration_iuts', name: 'Proforma Déclaration IUTS', description: 'Données des prélèvements sur salaires (à reporter sur e-SINTAX).', regime: ['RSI', 'RNI'] },
      { id: 'registre_recettes', name: 'Registre chronologique des recettes', description: 'Obligatoire pour les micro-entreprises.', regime: ['CME'] },
    ];
    return docs.filter(d => d.regime.includes(regime));
  };

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto">
      <header className="mb-10">
        <h1 className="text-3xl md:text-4xl font-serif tracking-tight mb-2 text-gold-100">Documents Fiscaux</h1>
        <p className="text-zinc-400 font-sans mb-4">Générez et gérez vos documents fiscaux adaptés à votre régime ({company?.taxRegime}).</p>
        
        <div className="p-4 rounded-xl bg-luxury-800/80 border border-gold-500/20 shadow-[0_0_15px_rgba(212,175,55,0.1)]">
          <p className="text-sm font-sans text-gold-500/80">
            <strong className="text-gold-300">Avis Important :</strong> Conformément à la réglementation de la DGI du Burkina Faso, 
            les documents régaliens (Attestations de Situation Fiscale, Quittances e-SINTAX, Certificats d'exonération) 
            relèvent de la compétence exclusive de l'administration et ne peuvent être générés par Libriwouô.
          </p>
        </div>
      </header>

      <div className="grid gap-4">
        {getDocuments().map((doc) => (
          <motion.div 
            key={doc.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-6 rounded-2xl bg-luxury-800/50 backdrop-blur-md border border-gold-500/10 flex items-center justify-between hover:bg-gold-500/5 hover:border-gold-500/30 transition-all duration-300"
          >
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-gold-500/10 text-gold-400 border border-gold-500/20">
                <FileText className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-serif text-gold-100 text-lg">{doc.name}</h3>
                <p className="text-sm text-gold-500/60">{doc.description}</p>
              </div>
            </div>
            <button 
              onClick={() => generateDocument(doc)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-gold-500 to-gold-400 text-zinc-900 text-sm font-semibold hover:from-gold-400 hover:to-gold-300 transition-all duration-300 shadow-[0_0_15px_rgba(212,175,55,0.2)] hover:shadow-[0_0_20px_rgba(212,175,55,0.4)]"
            >
              <Download className="w-4 h-4" />
              Générer
            </button>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
