#!/usr/bin/env python3
"""
Script pour convertir les diagrammes Mermaid en images et les ajouter au PDF
"""

import os
import sys
import subprocess
from pathlib import Path

def install_dependencies():
    """Installe les dépendances nécessaires"""
    print("📦 Installation des dépendances...")
    
    # Vérifier si Node.js est installé
    try:
        subprocess.run(['node', '--version'], capture_output=True, check=True)
        print("✓ Node.js trouvé")
    except:
        print("❌ Node.js n'est pas installé")
        return False
    
    # Installer mermaid-cli globalement
    print("📦 Installation de mermaid-cli...")
    os.system('npm install -g @mermaid-js/mermaid-cli -q')
    print("✓ mermaid-cli installé")
    
    return True

def create_mermaid_diagrams():
    """Crée les fichiers Mermaid pour conversion"""
    diagrams = {
        'architecture.mmd': '''graph TB
    UI["🖥️ Frontend<br/>React + TypeScript<br/>Vite + TailwindCSS"]
    API["⚙️ Backend API<br/>FastAPI<br/>REST + WebSocket"]
    DB["💾 Base de Données<br/>SQLite / PostgreSQL<br/>SQLAlchemy ORM"]
    MAIL["📧 Service Email<br/>SMTP<br/>Notifications"]
    
    UI -->|HTTP REST| API
    UI -->|WebSocket (Temps Réel)| API
    API -->|Query/Update Demandes| DB
    API -->|Trigger Événements| MAIL
    
    style UI fill:#0284c7,stroke:#0c4a6e,color:#fff
    style API fill:#059669,stroke:#064e3b,color:#fff
    style DB fill:#7c3aed,stroke:#5b21b6,color:#fff
    style MAIL fill:#dc2626,stroke:#991b1b,color:#fff''',
        
        'flux_communication.mmd': '''sequenceDiagram
    participant TC as 🏭 Technicentre
    participant Frontend as 🖥️ Frontend
    participant Backend as ⚙️ Backend
    participant DB as 💾 BD
    participant Mail as 📧 Email
    
    TC->>Frontend: Crée demande
    Frontend->>Backend: POST /alerts
    Backend->>DB: Crée Demande
    Backend->>DB: Crée MailEvent
    Backend->>Mail: REQUEST_CREATED
    Mail-->>Backend: Email envoyé
    Backend-->>Frontend: 201 Créée
    Frontend->>TC: ✓ Succès''',
        
        'etats_transitions.mmd': '''stateDiagram-v2
    [*] --> EN_COURS
    
    EN_COURS --> A_MODIFIER: Demande modification
    EN_COURS --> VALIDÉE: PERMANENT valide
    EN_COURS --> ANNULEE: Annulation
    
    A_MODIFIER --> EN_COURS: TECHNICENTRE modifie
    A_MODIFIER --> ANNULEE: Annulation
    
    VALIDÉE --> RECEPTION_EN_INSTANCE: Matériel en transit
    RECEPTION_EN_INSTANCE --> RECEPTION_CONFIRMEE: Réception confirmée
    RECEPTION_EN_INSTANCE --> RECEPTION_PARTIELLE: Réception partielle
    RECEPTION_EN_INSTANCE --> RECEPTION_PROBLEME: Problème signalé
    
    RECEPTION_CONFIRMEE --> [*]
    RECEPTION_PARTIELLE --> [*]
    RECEPTION_PROBLEME --> [*]
    ANNULEE --> [*]''',
        
        'phases_workflow.mmd': '''graph TD
    P1["<b>PHASE 1: Création</b><br/>TECHNICENTRE crée demande<br/>Statut: EN_COURS"]
    P2["<b>PHASE 2: Analyse</b><br/>PERMANENT valide<br/>Statut: VALIDÉE"]
    P3["<b>PHASE 3: Transit</b><br/>Matériel en acheminement<br/>Statut: EN_INSTANCE"]
    P4["<b>PHASE 4: Réception</b><br/>TECHNICENTRE reçoit<br/>Statut: CONFIRMÉE"]
    
    P1 -->|Email: REQUEST_CREATED| P2
    P2 -->|Email: DECISION_MADE| P3
    P3 -->|Matériel livré| P4
    P4 -->|Email: RECEPTION_CONFIRMED| Done["✓ Archivée"]
    
    style P1 fill:#fbbf24
    style P2 fill:#60a5fa
    style P3 fill:#34d399
    style P4 fill:#10b981
    style Done fill:#059669,color:#fff''',
    }
    
    diagrams_dir = Path('diagrams')
    diagrams_dir.mkdir(exist_ok=True)
    
    for filename, content in diagrams.items():
        filepath = diagrams_dir / filename
        filepath.write_text(content)
        print(f"  ✓ Créé: {filename}")
    
    return diagrams_dir

def convert_diagrams_to_png(diagrams_dir):
    """Convertit les fichiers Mermaid en PNG"""
    print("\n🔄 Conversion Mermaid → PNG en cours...")
    
    images = {}
    for mmd_file in diagrams_dir.glob('*.mmd'):
        png_file = mmd_file.with_suffix('.png')
        print(f"  ⏳ Conversion de {mmd_file.name}...", end=' ')
        
        try:
            # Utiliser mmdc (mermaid-cli)
            result = subprocess.run(
                ['mmdc', '-i', str(mmd_file), '-o', str(png_file), '-w', '1200', '-H', '800'],
                capture_output=True,
                timeout=30
            )
            
            if result.returncode == 0 and png_file.exists():
                images[mmd_file.stem] = str(png_file)
                print("✓")
            else:
                print(f"⚠️  Erreur")
        except subprocess.TimeoutExpired:
            print("❌ Timeout")
        except Exception as e:
            print(f"❌ {e}")
    
    return images

def generate_pdf_with_diagrams(images):
    """Génère le PDF avec les diagrammes intégrés"""
    print("\n📄 Génération du PDF avec diagrammes...")
    
    from datetime import datetime
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.lib.units import inch, cm
    from reportlab.lib.colors import HexColor, white
    from reportlab.platypus import (
        SimpleDocTemplate, Paragraph, Spacer, PageBreak, Table, TableStyle,
        Image, KeepTogether
    )
    from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_JUSTIFY
    
    filename = "Documentation_Technique_ONCF_HTML.pdf"
    pagesize = A4
    width, height = pagesize
    
    doc = SimpleDocTemplate(
        filename,
        pagesize=pagesize,
        rightMargin=0.75*inch,
        leftMargin=0.75*inch,
        topMargin=0.75*inch,
        bottomMargin=0.75*inch,
        title="Documentation Technique ONCF",
        author="ONCF"
    )
    
    styles = getSampleStyleSheet()
    
    title_style = ParagraphStyle(
        'CustomTitle',
        parent=styles['Heading1'],
        fontSize=28,
        textColor=HexColor("#1e3a8a"),
        spaceAfter=6,
        alignment=TA_CENTER,
        fontName='Helvetica-Bold'
    )
    
    heading2_style = ParagraphStyle(
        'CustomHeading2',
        parent=styles['Heading2'],
        fontSize=16,
        textColor=HexColor("#1e3a8a"),
        spaceAfter=12,
        spaceBefore=12,
        fontName='Helvetica-Bold',
        borderLeft=2,
        borderColor=HexColor("#2563eb")
    )
    
    heading3_style = ParagraphStyle(
        'CustomHeading3',
        parent=styles['Heading3'],
        fontSize=13,
        textColor=HexColor("#2563eb"),
        spaceAfter=8,
        fontName='Helvetica-Bold'
    )
    
    body_style = ParagraphStyle(
        'CustomBody',
        parent=styles['BodyText'],
        fontSize=10,
        alignment=TA_JUSTIFY,
        spaceAfter=10,
        leading=14
    )
    
    elements = []
    
    # ===== PAGE DE TITRE =====
    elements.append(Spacer(1, 1*inch))
    elements.append(Paragraph("📋 Documentation Technique", title_style))
    elements.append(Spacer(1, 0.2*inch))
    
    subtitle_style = ParagraphStyle(
        'Subtitle',
        fontSize=14,
        textColor=HexColor("#2563eb"),
        alignment=TA_CENTER,
        spaceAfter=6,
        fontName='Helvetica'
    )
    elements.append(Paragraph("Plateforme de Gestion des Demandes d'Acheminement", subtitle_style))
    elements.append(Paragraph("du Matériel Roulant - ONCF", subtitle_style))
    elements.append(Spacer(1, 0.5*inch))
    
    date_style = ParagraphStyle(
        'DateStyle',
        fontSize=10,
        textColor=HexColor("#666"),
        alignment=TA_CENTER
    )
    today = datetime.now().strftime("%d %B %Y")
    elements.append(Paragraph(f"Généré le: <b>{today}</b>", date_style))
    elements.append(Paragraph("<b>Version 2.0 - Avec Diagrammes</b>", date_style))
    elements.append(PageBreak())
    
    # ===== CONTENU PRINCIPAL (Extraction du HTML) =====
    # Section 1: Contexte
    elements.append(Paragraph("1. Contexte et Problématique", heading2_style))
    elements.append(Paragraph("1.1 Contexte Organisationnel", heading3_style))
    elements.append(Paragraph(
        "L'Office National des Chemins de Fer (ONCF) exploite un réseau ferroviaire national composé de plusieurs technicentres "
        "régionaux. Chaque technicentre gère son parc de matériel roulant et coordonne avec les autres technicentres pour "
        "l'acheminement de matériel nécessitant une maintenance spécialisée.",
        body_style
    ))
    
    elements.append(Paragraph("1.2 Problématiques Actuelles", heading3_style))
    issues = [
        "❌ <b>Absence de centralisation</b> - Pas de système centralisé pour gérer les demandes",
        "❌ <b>Communication fragmentée</b> - Communications désorganisées entre acteurs",
        "❌ <b>Risque d'erreurs</b> - Transmission manuelle entraîne des oublis",
        "❌ <b>Manque de traçabilité</b> - Pas d'historique consultable",
        "❌ <b>Absence de notifications</b> - Pas de notification automatique"
    ]
    for issue in issues:
        elements.append(Paragraph(issue, body_style))
    
    elements.append(PageBreak())
    
    # Section 2: Solution
    elements.append(Paragraph("2. Solution Proposée", heading2_style))
    elements.append(Paragraph("2.1 Acteurs et Rôles", heading3_style))
    
    roles_data = [
        ["Rôle", "Description"],
        ["🏭 TECHNICENTRE (Demandeur)", "Crée la demande d'acheminement"],
        ["👨‍💼 PERMANENT (PM)", "Valide la demande"],
        ["🏭 TECHNICENTRE (Récepteur)", "Confirme la réception"],
        ["⚙️ ADMINISTRATEUR", "Gère les comptes et l'historique"],
        ["📊 SUIVI", "Consulte les statistiques"],
    ]
    
    roles_table = Table(roles_data, colWidths=[2*inch, 4*inch])
    roles_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), HexColor("#1e3a8a")),
        ('TEXTCOLOR', (0, 0), (-1, 0), white),
        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 9),
        ('GRID', (0, 0), (-1, -1), 1, HexColor("#ddd")),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [white, HexColor("#f9f9f9")]),
    ]))
    elements.append(roles_table)
    elements.append(PageBreak())
    
    # Section 3: Architecture avec DIAGRAMME
    elements.append(Paragraph("3. Architecture Technique", heading2_style))
    elements.append(Paragraph("3.1 Architecture Générale", heading3_style))
    
    if 'architecture' in images:
        try:
            img = Image(images['architecture'], width=6.5*inch, height=4.875*inch)
            elements.append(img)
            elements.append(Spacer(1, 0.2*inch))
        except Exception as e:
            print(f"⚠️  Erreur ajout image architecture: {e}")
    
    elements.append(Paragraph(
        "<b>Composants:</b> Frontend (React) ↔ Backend (FastAPI) ↔ Database (SQLAlchemy) + Email Service",
        body_style
    ))
    elements.append(PageBreak())
    
    # Section 4: Workflow avec DIAGRAMMES
    elements.append(Paragraph("4. Workflow Complet", heading2_style))
    
    elements.append(Paragraph("4.1 États et Transitions", heading3_style))
    if 'etats_transitions' in images:
        try:
            img = Image(images['etats_transitions'], width=6.5*inch, height=4.875*inch)
            elements.append(img)
            elements.append(Spacer(1, 0.2*inch))
        except Exception as e:
            print(f"⚠️  Erreur ajout image états: {e}")
    
    elements.append(PageBreak())
    
    elements.append(Paragraph("4.2 Phases du Workflow", heading3_style))
    if 'phases_workflow' in images:
        try:
            img = Image(images['phases_workflow'], width=6.5*inch, height=4.875*inch)
            elements.append(img)
            elements.append(Spacer(1, 0.2*inch))
        except Exception as e:
            print(f"⚠️  Erreur ajout image phases: {e}")
    
    elements.append(PageBreak())
    
    # Section 5: Flux de Communication
    elements.append(Paragraph("5. Flux de Communication", heading2_style))
    if 'flux_communication' in images:
        try:
            img = Image(images['flux_communication'], width=6.5*inch, height=3.25*inch)
            elements.append(img)
            elements.append(Spacer(1, 0.2*inch))
        except Exception as e:
            print(f"⚠️  Erreur ajout image flux: {e}")
    
    elements.append(Paragraph(
        "Communication synchronisée entre tous les acteurs via WebSocket pour les mises à jour temps réel.",
        body_style
    ))
    
    elements.append(PageBreak())
    
    # Section 6: Technologies
    elements.append(Paragraph("6. Technologies Utilisées", heading2_style))
    
    tech_data = [
        ["Composant", "Technologie"],
        ["Framework Web", "FastAPI"],
        ["ORM", "SQLAlchemy 2"],
        ["Frontend", "React 18 + TypeScript"],
        ["Build Tool", "Vite"],
        ["Styling", "TailwindCSS"],
        ["Authentification", "JWT + passlib + bcrypt"],
        ["Email", "SMTP"],
        ["Temps Réel", "WebSocket"],
    ]
    
    tech_table = Table(tech_data, colWidths=[2.5*inch, 3.5*inch])
    tech_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), HexColor("#1e3a8a")),
        ('TEXTCOLOR', (0, 0), (-1, 0), white),
        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 9),
        ('GRID', (0, 0), (-1, -1), 1, HexColor("#ddd")),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [white, HexColor("#f9f9f9")]),
    ]))
    elements.append(tech_table)
    
    elements.append(PageBreak())
    
    # Section 7: Sécurité
    elements.append(Paragraph("7. Sécurité", heading2_style))
    security_items = [
        "✓ <b>Authentification JWT</b> - Toutes les requêtes sans JWT sont rejetées",
        "✓ <b>Autorisations de Rôle</b> - Validation du rôle pour chaque endpoint",
        "✓ <b>Hash Passwords</b> - Utilisation de bcrypt",
        "✓ <b>Protection SQL</b> - Via SQLAlchemy ORM",
        "✓ <b>CORS</b> - Configuré pour domaines autorisés",
        "✓ <b>Validation Données</b> - Pydantic valide toutes entrées",
    ]
    for item in security_items:
        elements.append(Paragraph(item, body_style))
    
    # Footer
    elements.append(Spacer(1, 0.5*inch))
    footer_style = ParagraphStyle(
        'Footer',
        fontSize=8,
        textColor=HexColor("#666"),
        alignment=TA_CENTER
    )
    elements.append(Paragraph("© 2024 ONCF - Tous droits réservés", footer_style))
    
    try:
        doc.build(elements)
        file_size = Path(filename).stat().st_size / 1024
        print(f"\n✅ PDF généré avec succès!")
        print(f"   Fichier: {filename}")
        print(f"   Taille: {file_size:.1f} KB")
        print(f"   Diagrammes intégrés: {len(images)}")
        return True
    except Exception as e:
        print(f"❌ Erreur génération PDF: {e}")
        return False

def main():
    """Fonction principale"""
    print("🚀 Génération du PDF avec diagrammes Mermaid\n")
    
    # Vérifier/installer mermaid-cli
    if not install_dependencies():
        print("\n❌ Erreur: mermaid-cli n'a pas pu être installé")
        print("ℹ️  Installez Node.js et réessayez")
        return False
    
    # Créer fichiers Mermaid
    diagrams_dir = create_mermaid_diagrams()
    
    # Convertir en PNG
    images = convert_diagrams_to_png(diagrams_dir)
    
    if not images:
        print("\n❌ Erreur: Aucun diagramme n'a pu être converti")
        return False
    
    # Générer PDF avec diagrammes
    return generate_pdf_with_diagrams(images)

if __name__ == "__main__":
    os.chdir(Path(__file__).parent)
    success = main()
    sys.exit(0 if success else 1)
