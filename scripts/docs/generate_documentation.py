#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Générateur de documentation technique PDF pour le projet ONCF
"""

from pathlib import Path
from datetime import datetime
import base64
import io

try:
    from reportlab.lib.pagesizes import letter, A4
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle, StyleSheet1
    from reportlab.lib.units import inch, cm
    from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_JUSTIFY, TA_RIGHT
    from reportlab.platypus import (
        SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, PageBreak, 
        Image, KeepTogether, PageTemplate, Frame, BaseDocTemplate
    )
    from reportlab.lib import colors
    from reportlab.pdfgen import canvas
except ImportError:
    print("Installation de reportlab...")
    import subprocess
    subprocess.check_call(["pip", "install", "reportlab"])
    from reportlab.lib.pagesizes import letter, A4
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.lib.units import inch, cm
    from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_JUSTIFY, TA_RIGHT
    from reportlab.platypus import (
        SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, PageBreak, Image, KeepTogether
    )
    from reportlab.lib import colors

# Créer le PDF
def create_documentation():
    """Crée la documentation technique en PDF"""
    
    output_path = Path("c:/Users/lenovo/Desktop/demo oncf") / "Documentation_Technique_ONCF.pdf"
    doc = SimpleDocTemplate(str(output_path), pagesize=A4, topMargin=1*cm, bottomMargin=1*cm, leftMargin=1.5*cm, rightMargin=1.5*cm)
    
    # Styles
    styles = getSampleStyleSheet()
    
    title_style = ParagraphStyle(
        'CustomTitle',
        parent=styles['Heading1'],
        fontSize=24,
        textColor=colors.HexColor('#1e3a8a'),
        spaceAfter=12,
        alignment=TA_CENTER,
        fontName='Helvetica-Bold'
    )
    
    heading1_style = ParagraphStyle(
        'CustomHeading1',
        parent=styles['Heading1'],
        fontSize=16,
        textColor=colors.HexColor('#1e3a8a'),
        spaceAfter=10,
        spaceBefore=10,
        fontName='Helvetica-Bold'
    )
    
    heading2_style = ParagraphStyle(
        'CustomHeading2',
        parent=styles['Heading2'],
        fontSize=13,
        textColor=colors.HexColor('#2563eb'),
        spaceAfter=8,
        spaceBefore=8,
        fontName='Helvetica-Bold'
    )
    
    body_style = ParagraphStyle(
        'CustomBody',
        parent=styles['BodyText'],
        fontSize=10,
        alignment=TA_JUSTIFY,
        spaceAfter=8
    )
    
    # Contenu du PDF
    story = []
    
    # ===== PAGE DE TITRE =====
    story.append(Spacer(1, 1.5*cm))
    story.append(Paragraph("DOCUMENTATION TECHNIQUE", title_style))
    story.append(Spacer(1, 0.3*cm))
    story.append(Paragraph("PLATEFORME DE GESTION D'ACHEMINEMENT<br/>DU MATÉRIEL ROULANT", heading1_style))
    story.append(Spacer(1, 0.5*cm))
    story.append(Paragraph("ONCF - Office National des Chemins de Fer", body_style))
    story.append(Spacer(1, 2*cm))
    story.append(Paragraph(f"Date: {datetime.now().strftime('%d/%m/%Y')}", body_style))
    story.append(Paragraph("Version: 1.0", body_style))
    story.append(PageBreak())
    
    # ===== TABLE DES MATIÈRES =====
    story.append(Paragraph("TABLE DES MATIÈRES", heading1_style))
    story.append(Spacer(1, 0.5*cm))
    toc_items = [
        "1. Contexte et Problématique",
        "2. Solution Proposée",
        "3. Exigences Fonctionnelles et Cas d'Utilisation",
        "4. Architecture Technique",
        "5. Modèle de Base de Données",
        "6. Authentification et Gestion des Rôles",
        "7. Technologies Utilisées",
        "8. Implémentation des Fonctionnalités Principales",
        "9. Interfaces Utilisateur",
        "10. Flux d'Utilisation",
    ]
    for item in toc_items:
        story.append(Paragraph(item, body_style))
    story.append(PageBreak())
    
    # ===== 1. CONTEXTE ET PROBLÉMATIQUE =====
    story.append(Paragraph("1. CONTEXTE ET PROBLÉMATIQUE", heading1_style))
    story.append(Spacer(1, 0.3*cm))
    
    story.append(Paragraph("1.1 Contexte Organisationnel", heading2_style))
    context_text = """
    L'Office National des Chemins de Fer (ONCF) exploite un réseau ferroviaire national composé de plusieurs 
    technicentres régionaux. Chaque technicentre gère son parc de matériel roulant et coordonne avec les autres 
    technicentres pour l'acheminement de matériel nécessitant une maintenance spécialisée. Lorsqu'un matériel 
    ferroviaire nécessite une intervention, il doit être acheminé depuis son technicentre d'origine vers un 
    technicentre spécialisé pour la maintenance.
    """
    story.append(Paragraph(context_text.strip(), body_style))
    story.append(Spacer(1, 0.3*cm))
    
    story.append(Paragraph("1.2 Problématique Identifiée", heading2_style))
    problems = [
        "<b>Absence de centralisation:</b> Le processus actuel d'acheminement du matériel roulant manque d'un système centralisé pour initier, suivre et valider les demandes d'acheminement.",
        "<b>Communication fragmentée:</b> Les communications entre les technicentres demandeurs, le Permanent PM et les technicentres récepteurs sont fragmentées et peu structurées.",
        "<b>Risque d'erreurs:</b> Absence de mécanisme de validation formelle entraîne des risques d'erreurs ou d'oublis dans la transmission des informations techniques (numéro de série, type de matériel, vitesse d'acheminement, mode d'acheminement).",
        "<b>Manque de traçabilité:</b> Pas d'historique consultable des acheminements effectués, rendant difficile le suivi et l'audit des demandes.",
        "<b>Absence de notifications automatiques:</b> Pas de notification automatique des parties prenantes lors des changements d'état d'une demande d'acheminement.",
    ]
    for problem in problems:
        story.append(Paragraph(f"• {problem}", body_style))
    story.append(Spacer(1, 0.3*cm))
    
    story.append(Paragraph("1.3 Conséquences", heading2_style))
    consequences_text = """
    Ces dysfonctionnements entraînent des retards dans la maintenance, une gestion sous-optimale du parc 
    matériel, une charge administrative accrue pour le personnel, et des difficultés de suivi des actifs critiques.
    """
    story.append(Paragraph(consequences_text.strip(), body_style))
    story.append(PageBreak())
    
    # ===== 2. SOLUTION PROPOSÉE =====
    story.append(Paragraph("2. SOLUTION PROPOSÉE", heading1_style))
    story.append(Spacer(1, 0.3*cm))
    
    story.append(Paragraph("2.1 Vision Générale", heading2_style))
    solution_text = """
    Une plateforme collaborative de gestion des demandes d'acheminement et du suivi du cycle de vie 
    complet d'une demande, impliquant trois acteurs principaux aux rôles bien définis et interopérables.
    """
    story.append(Paragraph(solution_text.strip(), body_style))
    story.append(Spacer(1, 0.3*cm))
    
    story.append(Paragraph("2.2 Acteurs et Rôles", heading2_style))
    
    roles_data = [
        ["Rôle", "Responsabilités"],
        ["TECHNICENTRE (Demandeur)", "Crée la demande d'acheminement avec tous les détails du matériel à acheminer"],
        ["PERMANENT (PM)", "Reçoit, examine et traite la demande : confirmation, demande de modification ou annulation"],
        ["TECHNICENTRE (Récepteur)", "Reçoit et réceptionne le matériel, valide la réception via la plateforme"],
        ["ADMINISTRATEUR", "Gère les comptes utilisateurs, adresses email, et exporte l'historique"],
        ["SUIVI", "Consulte les historiques et statistiques des demandes d'acheminement"],
    ]
    
    table = Table(roles_data, colWidths=[2.5*cm, 12*cm])
    table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#1e3a8a')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, 0), 10),
        ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
        ('BACKGROUND', (0, 1), (-1, -1), colors.beige),
        ('GRID', (0, 0), (-1, -1), 1, colors.black),
        ('FONTSIZE', (0, 1), (-1, -1), 9),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
    ]))
    story.append(table)
    story.append(Spacer(1, 0.5*cm))
    
    story.append(Paragraph("2.3 Fonctionnalités Clés", heading2_style))
    features = [
        "Création et gestion centralisée des demandes d'acheminement de matériel",
        "Workflow structuré avec validations à chaque étape par le PERMANENT",
        "Suivi en temps réel des demandes via WebSocket",
        "Historique complet et traçabilité des modifications et décisions",
        "Notifications automatiques par email aux parties prenantes",
        "Pièces jointes et documentation technique associées",
        "Export des données pour audit et reporting",
        "Authentification sécurisée avec rôles et permissions",
    ]
    for feature in features:
        story.append(Paragraph(f"✓ {feature}", body_style))
    story.append(PageBreak())
    
    # ===== 3. EXIGENCES FONCTIONNELLES =====
    story.append(Paragraph("3. EXIGENCES FONCTIONNELLES ET CAS D'UTILISATION", heading1_style))
    story.append(Spacer(1, 0.3*cm))
    
    story.append(Paragraph("3.1 Exigences Fonctionnelles Principales", heading2_style))
    
    req_data = [
        ["ID", "Exigence", "Description"],
        ["REQ-001", "Création Demande", "Un TECHNICENTRE peut créer une demande d'acheminement avec tous les détails"],
        ["REQ-002", "Validation Permanent", "Le PERMANENT peut valider, annuler ou demander modification"],
        ["REQ-003", "Notification Auto", "Les parties prenantes reçoivent automatiquement les notifications par email"],
        ["REQ-004", "Suivi Temps Réel", "Interface en temps réel via WebSocket pour le PERMANENT"],
        ["REQ-005", "Gestion Technicentres", "Admin peut gérer technicentres, gares et utilisateurs"],
        ["REQ-006", "Confirmation Réception", "Le TECHNICENTRE récepteur confirme la réception du matériel"],
        ["REQ-007", "Export Historique", "Admin peut exporter l'historique en Excel"],
        ["REQ-008", "Authentification JWT", "Tous les accès sont sécurisés par JWT"],
    ]
    
    req_table = Table(req_data, colWidths=[1.5*cm, 2.5*cm, 10*cm])
    req_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#1e3a8a')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, 0), 9),
        ('BOTTOMPADDING', (0, 0), (-1, 0), 10),
        ('BACKGROUND', (0, 1), (-1, -1), colors.lightgrey),
        ('GRID', (0, 0), (-1, -1), 1, colors.black),
        ('FONTSIZE', (0, 1), (-1, -1), 8),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.lightgrey]),
    ]))
    story.append(req_table)
    story.append(Spacer(1, 0.5*cm))
    
    story.append(Paragraph("3.2 Cas d'Utilisation Principaux", heading2_style))
    use_cases_text = """
    <b>UC-001: Créer une Demande d'Acheminement</b><br/>
    Le TECHNICENTRE demandeur remplit un formulaire avec informations du matériel, technicentre d'origine, 
    technicentre destinataire, description du problème, et peut ajouter des pièces jointes.<br/><br/>
    
    <b>UC-002: Analyser et Décider</b><br/>
    Le PERMANENT examine la demande, peut demander des modifications au TECHNICENTRE demandeur, 
    ou valide en spécifiant le technicentre récepteur et la date/heure d'arrivée prévue.<br/><br/>
    
    <b>UC-003: Confirmer Réception</b><br/>
    Le TECHNICENTRE récepteur réceptionne le matériel et confirme via la plateforme, en indiquant la date 
    réelle de réception et tout problème éventuel.<br/><br/>
    
    <b>UC-004: Consulter Historique</b><br/>
    L'ADMIN et SUIVI peuvent consulter l'historique complet de toutes les demandes avec filtres et recherche.
    """
    story.append(Paragraph(use_cases_text, body_style))
    story.append(PageBreak())
    
    # ===== 4. ARCHITECTURE TECHNIQUE =====
    story.append(Paragraph("4. ARCHITECTURE TECHNIQUE", heading1_style))
    story.append(Spacer(1, 0.3*cm))
    
    story.append(Paragraph("4.1 Architecture Générale", heading2_style))
    arch_text = """
    La solution suit une architecture moderne en trois couches :<br/>
    • <b>Couche Frontend:</b> Interface utilisateur réactive basée sur React et TypeScript<br/>
    • <b>Couche Backend:</b> API REST + WebSocket construite avec FastAPI<br/>
    • <b>Couche Données:</b> Base de données relationnelle (SQLite ou PostgreSQL)
    """
    story.append(Paragraph(arch_text, body_style))
    story.append(Spacer(1, 0.3*cm))
    
    story.append(Paragraph("4.2 Flux d'Architecture", heading2_style))
    flow_text = """
    <b>Authentification:</b> Utilisateur → Login FastAPI → JWT Token → Stockage Client<br/>
    <b>CRUD Demandes:</b> Frontend (React) ↔ API REST (FastAPI) ↔ Base de Données (SQLAlchemy ORM)<br/>
    <b>Temps Réel:</b> WebSocket Connection → ConnectionManager → Broadcast JSON aux clients<br/>
    <b>Notifications:</b> Trigger Métier (décision PERMANENT) → Service de Mailing → SMTP → Email
    """
    story.append(Paragraph(flow_text, body_style))
    story.append(Spacer(1, 0.3*cm))
    
    story.append(Paragraph("4.3 Composants Backend", heading2_style))
    components_text = """
    <b>app/main.py:</b> Point d'entrée FastAPI, CORS, routers, WebSocket, lifespan<br/>
    <b>app/api/:</b> Endpoints organisés par domaine (auth, alerts pour demandes, admin, meta)<br/>
    <b>app/core/:</b> Configuration, sécurité, références métier<br/>
    <b>app/db/:</b> Session SQLAlchemy, bootstrap migrations<br/>
    <b>app/models/:</b> Modèles ORM et enums<br/>
    <b>app/schemas/:</b> Pydantic DTO pour validation/sérialisation<br/>
    <b>app/services/:</b> Logique métier (demandes helpers, mailing, WebSocket, storage)<br/>
    <b>alembic/:</b> Migrations de base de données versionnées
    """
    story.append(Paragraph(components_text, body_style))
    story.append(PageBreak())
    
    # ===== 5. MODÈLE DE BASE DE DONNÉES =====
    story.append(Paragraph("5. MODÈLE DE BASE DE DONNÉES", heading1_style))
    story.append(Spacer(1, 0.3*cm))
    
    story.append(Paragraph("5.1 Entités Principales", heading2_style))
    
    entities_data = [
        ["Table", "Description", "Clés Principales"],
        ["users", "Comptes utilisateurs avec rôles et technicentres", "id, role, establishment_id"],
        ["establishments", "Technicentres du réseau ONCF", "id, code, name"],
        ["stations", "Gares du réseau ONCF", "id, code, name"],
        ["alerts", "Demandes d'acheminement avec détails techniques", "id, status, severity"],
        ["alert_status_history", "Timeline des changements d'état de demandes", "alert_id, status, changed_at"],
        ["permanent_decisions", "Décisions du PERMANENT (confirmation/annulation)", "alert_id, decision, eta_date"],
        ["establishment_confirmations", "Confirmation réception TECHNICENTRE récepteur", "alert_id, reception_date"],
        ["notifications", "Notifications aux technicentres", "alert_id, to_establishment_id"],
        ["alert_attachments", "Pièces jointes aux demandes", "alert_id, filename, stored_path"],
        ["alert_revisions", "Historique des modifications de demandes", "alert_id, revision_number"],
        ["mail_events", "Log des emails envoyés", "alert_id, event_type, recipient"],
    ]
    
    entities_table = Table(entities_data, colWidths=[2.5*cm, 5.5*cm, 6*cm])
    entities_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#1e3a8a')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, 0), 8),
        ('BOTTOMPADDING', (0, 0), (-1, 0), 10),
        ('GRID', (0, 0), (-1, -1), 1, colors.black),
        ('FONTSIZE', (0, 1), (-1, -1), 7.5),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.lightgrey]),
    ]))
    story.append(entities_table)
    story.append(Spacer(1, 0.5*cm))
    
    story.append(Paragraph("5.2 Énumérations et Domaines", heading2_style))
    
    enums_data = [
        ["Enumération", "Valeurs"],
        ["UserRole", "TECHNICENTRE, PERMANENT, ADMIN, SUIVI"],
        ["AlertStatus", "EN_COURS_DE_TRAITEMENT, A_MODIFIER, VALIDEE_PAR_LE_PERMANENT, ANNULEE, RECEPTION_*"],
        ["Severity", "NIVEAU_1 à NIVEAU_5"],
        ["MaintenanceState", "OK, A_SURVEILLER, PFL, PV, A_REPARER, CRITIQUE"],
        ["DecisionKind", "CONFIRMER, ANNULER"],
        ["TransportMode", "FRET, VOYAGEURS"],
        ["TransportType", "HLP (Horizontal Load Positioner), autres types"],
    ]
    
    enums_table = Table(enums_data, colWidths=[3*cm, 12*cm])
    enums_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#2563eb')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, 0), 10),
        ('BOTTOMPADDING', (0, 0), (-1, 0), 10),
        ('GRID', (0, 0), (-1, -1), 1, colors.black),
        ('FONTSIZE', (0, 1), (-1, -1), 9),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#f0f0f0')]),
    ]))
    story.append(enums_table)
    story.append(PageBreak())
    
    # ===== 6. AUTHENTIFICATION ET GESTION DES RÔLES =====
    story.append(Paragraph("6. AUTHENTIFICATION ET GESTION DES RÔLES", heading1_style))
    story.append(Spacer(1, 0.3*cm))
    
    story.append(Paragraph("6.1 Mécanisme d'Authentification", heading2_style))
    auth_text = """
    <b>Type:</b> JWT (JSON Web Token)<br/>
    <b>Librarie:</b> python-jose pour la création/validation JWT<br/>
    <b>Hash Mots de Passe:</b> passlib + bcrypt<br/>
    <b>Endpoint:</b> POST /auth/login<br/>
    <b>Payload JWT:</b> {sub: user_id, exp: expiration_timestamp}
    """
    story.append(Paragraph(auth_text, body_style))
    story.append(Spacer(1, 0.3*cm))
    
    story.append(Paragraph("6.2 Flux d'Authentification", heading2_style))
    flow_auth = """
    1. Utilisateur soumet credentials (username, password)<br/>
    2. Backend valide username et vérifie password avec bcrypt<br/>
    3. Backend génère JWT avec secret clé et algorithme HS256<br/>
    4. Frontend stocke le token en localStorage/sessionStorage<br/>
    5. Frontend inclut "Authorization: Bearer {token}" dans chaque requête<br/>
    6. Backend valide le token à chaque requête protégée
    """
    story.append(Paragraph(flow_auth, body_style))
    story.append(Spacer(1, 0.3*cm))
    
    story.append(Paragraph("6.3 Gestion des Rôles et Permissions", heading2_style))
    
    perms_data = [
        ["Rôle", "Créer Demande", "Valider", "Confirmer Réception", "Gérer Comptes", "Consulter Historique"],
        ["TECHNICENTRE", "✓", "", "✓", "", "◐ (ses demandes)"],
        ["PERMANENT", "", "✓", "", "", "✓"],
        ["ADMIN", "✓", "✓", "✓", "✓", "✓"],
        ["SUIVI", "", "", "", "", "✓"],
    ]
    
    perms_table = Table(perms_data, colWidths=[2.5*cm, 2.2*cm, 2*cm, 2.5*cm, 2.2*cm, 2.2*cm])
    perms_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#1e3a8a')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, 0), 9),
        ('BOTTOMPADDING', (0, 0), (-1, 0), 10),
        ('GRID', (0, 0), (-1, -1), 1, colors.black),
        ('FONTSIZE', (0, 1), (-1, -1), 9),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#f0f0f0')]),
    ]))
    story.append(perms_table)
    story.append(Spacer(1, 0.5*cm))
    
    story.append(Paragraph("6.4 Implémentation des Contrôles d'Accès", heading2_style))
    impl_auth = """
    <b>Dépendances FastAPI:</b><br/>
    • get_current_user(): Valide JWT, charge l'utilisateur<br/>
    • require_roles(*roles): Vérifie que l'utilisateur a un des rôles spécifiés<br/><br/>
    
    <b>Exemple d'Utilisation:</b><br/>
    @app.post("/demands")<br/>
    def create_demand(current_user: User = Depends(get_current_user), ...):<br/>
    &nbsp;&nbsp;&nbsp;&nbsp;require_roles("TECHNICENTRE", "ADMIN")<br/>
    &nbsp;&nbsp;&nbsp;&nbsp;# Créer la demande d'acheminement
    """
    story.append(Paragraph(impl_auth, body_style))
    story.append(PageBreak())
    
    # ===== 7. TECHNOLOGIES UTILISÉES =====
    story.append(Paragraph("7. TECHNOLOGIES UTILISÉES", heading1_style))
    story.append(Spacer(1, 0.3*cm))
    
    story.append(Paragraph("7.1 Stack Backend", heading2_style))
    
    backend_stack = [
        ["Composant", "Technologie", "Version", "Usage"],
        ["Framework Web", "FastAPI", "0.100+", "API REST + WebSocket"],
        ["ORM", "SQLAlchemy 2", "2.0+", "Abstraction base de données"],
        ["Base Données", "SQLite/PostgreSQL", "", "Persistance données"],
        ["Migrations", "Alembic", "1.12+", "Versioning schema DB"],
        ["Authentification", "python-jose", "3.3+", "JWT management"],
        ["Hash Mots de Passe", "passlib + bcrypt", "", "Sécurité passwords"],
        ["Validation", "Pydantic", "2.0+", "Validation/sérialisation"],
        ["Email", "smtplib", "", "Envoi emails SMTP"],
        ["Async", "asyncio", "", "Opérations asynchrones"],
    ]
    
    backend_table = Table(backend_stack, colWidths=[2.5*cm, 3.5*cm, 1.8*cm, 5.2*cm])
    backend_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#059669')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, 0), 9),
        ('BOTTOMPADDING', (0, 0), (-1, 0), 10),
        ('GRID', (0, 0), (-1, -1), 1, colors.black),
        ('FONTSIZE', (0, 1), (-1, -1), 8),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#ecfdf5')]),
    ]))
    story.append(backend_table)
    story.append(Spacer(1, 0.3*cm))
    
    story.append(Paragraph("7.2 Stack Frontend", heading2_style))
    
    frontend_stack = [
        ["Composant", "Technologie", "Version", "Usage"],
        ["Langage", "TypeScript", "5.0+", "Typage statique"],
        ["Framework UI", "React", "18.0+", "Interface utilisateur"],
        ["Build Tool", "Vite", "4.0+", "Compilation optimisée"],
        ["Routing", "React Router", "6.0+", "Navigation entre pages"],
        ["Styling", "TailwindCSS", "3.0+", "Design système"],
        ["HTTP Client", "Fetch API", "", "Requêtes API"],
        ["WebSocket", "Native Browser WS", "", "Temps réel"],
        ["État", "Context API + Hooks", "", "Gestion état global"],
        ["PDF Export", "jsPDF + html2canvas", "", "Génération PDF"],
    ]
    
    frontend_table = Table(frontend_stack, colWidths=[2.5*cm, 3.5*cm, 1.8*cm, 5.2*cm])
    frontend_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#0284c7')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, 0), 9),
        ('BOTTOMPADDING', (0, 0), (-1, 0), 10),
        ('GRID', (0, 0), (-1, -1), 1, colors.black),
        ('FONTSIZE', (0, 1), (-1, -1), 8),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#f0f9ff')]),
    ]))
    story.append(frontend_table)
    story.append(Spacer(1, 0.3*cm))
    
    story.append(Paragraph("7.3 Infraestructure et Déploiement", heading2_style))
    infra_text = """
    <b>Conteneurisation:</b> Docker pour backend et frontend<br/>
    <b>Orchestration:</b> Docker Compose pour local/démo<br/>
    <b>Serveur Web:</b> Uvicorn (backend), Vite dev server ou nginx (frontend)<br/>
    <b>Configuration:</b> Variables d'environnement (.env)
    """
    story.append(Paragraph(infra_text, body_style))
    story.append(PageBreak())
    
    # ===== 8. IMPLÉMENTATION DES FONCTIONNALITÉS PRINCIPALES =====
    story.append(Paragraph("8. IMPLÉMENTATION DES FONCTIONNALITÉS PRINCIPALES", heading1_style))
    story.append(Spacer(1, 0.3*cm))
    
    story.append(Paragraph("8.1 Workflow Complet d'une Demande d'Acheminement", heading2_style))
    workflow_text = """
    <b>Phase 1 - Création (TECHNICENTRE Demandeur):</b><br/>
    1. TECHNICENTRE accède au formulaire de création de demande<br/>
    2. Remplir: gare d'origine, technicentre destinataire, matériel, problème, conditions transport<br/>
    3. Ajouter pièces jointes (fichiers)<br/>
    4. POST /alerts avec FormData<br/>
    5. Backend crée Demande avec status=EN_COURS_DE_TRAITEMENT<br/>
    6. Envoyer email REQUEST_CREATED à PERMANENT<br/>
    7. WS broadcast demande_created à tous les clients<br/><br/>
    
    <b>Phase 2 - Analyse (PERMANENT):</b><br/>
    1. PERMANENT reçoit notification email<br/>
    2. Accède au dashboard et ouvre la demande<br/>
    3. Analyser détails et pièces jointes<br/>
    4. Trois choix:<br/>
    &nbsp;&nbsp;&nbsp;&nbsp;a) CONFIRMER: Choisir technicentre récepteur, ETA, conditions transport finales<br/>
    &nbsp;&nbsp;&nbsp;&nbsp;b) ANNULER: Motif d'annulation<br/>
    &nbsp;&nbsp;&nbsp;&nbsp;c) DEMANDER MODIFICATION: AGENT en est notifié<br/>
    5. PUT /alerts/{id}/permanent-decision<br/>
    6. Créer PermanentDecision, mettre à jour Alert status<br/>
    7. Envoyer emails DECISION_MADE à AGENT et ÉTABLISSEMENT destinataire<br/><br/>
    
    <b>Phase 3 - Modification (optionnel):</b><br/>
    1. AGENT met à jour l'alerte via PUT /alerts/{id}<br/>
    2. Créer AlertRevision (archive version précédente)<br/>
    3. Mettre à jour Alert, status=EN_COURS_DE_TRAITEMENT<br/>
    4. Envoyer email REQUEST_UPDATED à PERMANENT<br/>
    5. Retour à Phase 2<br/><br/>
    
    <b>Phase 4 - Réception (ÉTABLISSEMENT):</b><br/>
    1. ÉTABLISSEMENT reçoit notification email avec lien<br/>
    2. Accède à TechnicentreReceptionDetailPage<br/>
    3. Confirmer réception: date/heure réelle, état matériel, remarques<br/>
    4. POST /alerts/{id}/establishment-confirmation<br/>
    5. Créer EstablishmentConfirmation, mettre à jour Alert status<br/>
    6. Calculer delay_minutes (ETA vs réception réelle)<br/>
    7. Envoyer email RECEPTION_CONFIRMED à AGENT et PERMANENT<br/>
    8. Alert archivée et inaccessible en modification
    """
    story.append(Paragraph(workflow_text, body_style))
    story.append(PageBreak())
    
    story.append(Paragraph("8.2 Mécanisme d'Envoi des Emails", heading2_style))
    email_text = """
    <b>Architecture:</b><br/>
    1. Événement métier déclenche appel compose_*_mail(alert) en services/mailing.py<br/>
    2. Fonction retourne EmailMessage avec sujet et contenu HTML<br/>
    3. Collecter destinataires selon rôle (PERMANENT, ÉTABLISSEMENT, AGENT)<br/>
    4. Appel send_alert_mail(alert, email_message, event_type)<br/>
    5. Connexion SMTP, envoi message<br/>
    6. Créer MailEvent dans BD pour log<br/><br/>
    
    <b>Données du Contexte Email:</b><br/>
    • Dossier label: "Dossier #123"<br/>
    • Matériel: Type (MM/MR) + Numéro de série<br/>
    • Demandeur: Code établissement de l'AGENT<br/>
    • Destinataire: Code établissement choisi par PERMANENT<br/>
    • Dates: Request, ETA (si confirmée), réception<br/>
    • Délai: delay_minutes calculé<br/><br/>
    
    <b>Configuration SMTP:</b><br/>
    Variables d'environnement:<br/>
    • SMTP_HOST: Serveur SMTP (ex: smtp.gmail.com)<br/>
    • SMTP_PORT: Port (ex: 587)<br/>
    • SMTP_USERNAME: Email de connexion<br/>
    • SMTP_PASSWORD: Mot de passe<br/>
    • SMTP_USE_TLS: true/false<br/>
    • MAIL_SENDER_NAME: Expéditeur affiché
    """
    story.append(Paragraph(email_text, body_style))
    story.append(Spacer(1, 0.3*cm))
    
    story.append(Paragraph("8.3 Suivi en Temps Réel (WebSocket)", heading2_style))
    ws_text = """
    <b>Endpoint:</b> GET /ws/demands (ou /ws/alerts selon implémentation)<br/><br/>
    
    <b>Côté Backend (ConnectionManager):</b><br/>
    • Maintenir dictionnaire de connexions par channel<br/>
    • connect(channel, websocket): Ajouter à la liste<br/>
    • disconnect(channel, websocket): Retirer de la liste<br/>
    • broadcast(channel, message): Envoyer JSON à tous les connectés<br/><br/>
    
    <b>Cycles de Vie:</b><br/>
    1. Client établit connexion WebSocket<br/>
    2. Manager ajoute à la liste "demands"<br/>
    3. Boucle receive_text() écoute (keepalive)<br/>
    4. Chaque UPDATE DEMANDE: broadcast JSON {type, demand, timestamp}<br/>
    5. Tous les clients reçoivent et mettent à jour l'UI<br/>
    6. Sur déconnexion: retirer de la liste<br/><br/>
    
    <b>Messages Broadcast:</b><br/>
    {"type": "demand_created", "demand": {...}, "timestamp": "..."}  → Nouvelle demande<br/>
    {"type": "demand_updated", "demand": {...}, "timestamp": "..."}  → Modification<br/>
    {"type": "permanent_decision", "demand": {...}, "timestamp": "..."}  → Décision PERMANENT<br/>
    {"type": "establishment_confirmation", "demand": {...}, "timestamp": "..."}  → Réception
    """
    story.append(Paragraph(ws_text, body_style))
    story.append(PageBreak())
    
    # ===== 9. INTERFACES UTILISATEUR =====
    story.append(Paragraph("9. INTERFACES UTILISATEUR", heading1_style))
    story.append(Spacer(1, 0.3*cm))
    
    story.append(Paragraph("9.1 Écrans par Rôle", heading2_style))
    
    ui_data = [
        ["Rôle", "Écrans Principaux"],
        ["TECHNICENTRE", "LoginPage, NewDemandPage (créer), TechnicentreDashboard (mes demandes), DemandDetailPage, ReceptionDetailPage (confirmer réception), HistoryPage"],
        ["PERMANENT", "LoginPage, PermanentDashboard (demandes en attente), DemandDetailPage (avec formulaire décision), MapPage, WebSocket temps réel"],
        ["ADMIN", "LoginPage, AdminDashboard, AdminUserDetailPage (gestion comptes), AdminTechnicentreDetailPage, ExportPage (export Excel)"],
        ["SUIVI", "LoginPage, TrackingDashboard, TrackingAllPage (toutes les demandes), TrackingPlaybackPage (replay timeline)"],
    ]
    
    ui_table = Table(ui_data, colWidths=[2.5*cm, 12.5*cm])
    ui_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#7c3aed')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, 0), 10),
        ('BOTTOMPADDING', (0, 0), (-1, 0), 10),
        ('GRID', (0, 0), (-1, -1), 1, colors.black),
        ('FONTSIZE', (0, 1), (-1, -1), 8),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#f3e8ff')]),
    ]))
    story.append(ui_table)
    story.append(Spacer(1, 0.5*cm))
    
    story.append(Paragraph("9.2 Composants Réutilisables", heading2_style))
    components_text = """
    • <b>DemandCard:</b> Affichage résumé d'une demande (status badge, dates, matériel)<br/>
    • <b>DemandTimeline:</b> Timeline visuelle des changements de statut<br/>
    • <b>DecisionForm:</b> Formulaire saisie décision PERMANENT (technicentre, ETA, conditions)<br/>
    • <b>ConfirmationForm:</b> Formulaire confirmation réception TECHNICENTRE<br/>
    • <b>StatusBadge:</b> Indicateur couleur du statut (EN_COURS=jaune, VALIDÉE=vert, etc.)<br/>
    • <b>GeneratePdfButton:</b> Export demande en PDF<br/>
    • <b>RealtimeNotice:</b> Indicateur de connexion WebSocket<br/>
    • <b>PageSkeleton:</b> Skeleton loading lors du chargement
    """
    story.append(Paragraph(components_text, body_style))
    story.append(Spacer(1, 0.5*cm))
    
    story.append(Paragraph("9.3 Palette de Couleurs et Design", heading2_style))
    design_text = """
    <b>Marque ONCF:</b> Bleu primaire #1e3a8a, bleu secondaire #2563eb<br/>
    <b>Statuts:</b><br/>
    • EN_COURS_DE_TRAITEMENT: Jaune (#eab308)<br/>
    • VALIDÉE_PAR_LE_PERMANENT: Vert (#10b981)<br/>
    • ANNULEE: Rouge (#ef4444)<br/>
    • RECEPTION_CONFIRMÉE: Vert foncé (#059669)<br/><br/>
    
    <b>Framework CSS:</b> TailwindCSS avec configuration personnalisée<br/>
    <b>Design Pattern:</b> Mobile-first, responsive breakpoints (sm, md, lg, xl)
    """
    story.append(Paragraph(design_text, body_style))
    story.append(PageBreak())
    
    # ===== 10. FLUX D'UTILISATION =====
    story.append(Paragraph("10. FLUX D'UTILISATION", heading1_style))
    story.append(Spacer(1, 0.3*cm))
    
    story.append(Paragraph("10.1 Scénario Nominal Complet", heading2_style))
    scenario_text = """
    <b>Jour 1 - 09:00 - TECHNICENTRE crée une demande:</b><br/>
    Technicentre1 accède au formulaire de création, remplit:<br/>
    • Gare d'origine: Casablanca Voyageurs<br/>
    • Technicentre destinataire: Technicentre Marrakech<br/>
    • Matériel: MM type "Wagon XXX"<br/>
    • Problème: "Moteur défaillant, inspection requise"<br/>
    • Pièces jointes: photos_wagon.pdf<br/>
    • Appuie "Soumettre"<br/>
    → Demande créée avec ID #42, status EN_COURS_DE_TRAITEMENT<br/>
    → Email REQUEST_CREATED envoyé à Permanent PM<br/>
    → Dashboard Permanent se met à jour en temps réel (WebSocket)<br/><br/>
    
    <b>Jour 1 - 10:15 - PERMANENT analyse et valide:</b><br/>
    Permanent PM reçoit email, clique sur lien<br/>
    → Accès au détail de la demande #42<br/>
    Consulte tous les détails, photos, historique<br/>
    Décide d'accepter l'acheminement vers Marrakech<br/>
    • Technicentre destinataire: Technicentre Marrakech<br/>
    • ETA: 12:00 (aujourd'hui)<br/>
    • Conditions transport finales: "Transport routier spécialisé"<br/>
    • Appuie "CONFIRMER"<br/>
    → Demande #42 passe à status VALIDEE_PAR_LE_PERMANENT<br/>
    → PermanentDecision créée<br/>
    → Emails DECISION_MADE envoyés à Technicentre demandeur et Technicentre Marrakech<br/>
    → WS broadcast pour tous les connectés<br/><br/>
    
    <b>Jour 1 - 12:30 - TECHNICENTRE Récepteur confirme réception:</b><br/>
    Agent Marrakech (Technicentre récepteur) reçoit email avec lien direct<br/>
    → Accès au formulaire de confirmation de réception<br/>
    Confirme réception matériel:<br/>
    • Date/heure réception: 12:25<br/>
    • État: "Matériel reçu en bon état"<br/>
    • Appuie "CONFIRMER RÉCEPTION"<br/>
    → EstablishmentConfirmation créée<br/>
    → Delay_minutes calculé: -5 min (arrivée 5 min avant ETA)<br/>
    → Demande #42 passe à status RECEPTION_CONFIRMEE<br/>
    → Email RECEPTION_CONFIRMED envoyé<br/>
    → Demande supprimée des dashboards des actifs<br/>
    → Visible uniquement dans historique/suivi<br/><br/>
    
    <b>Jour 2 - SUIVI consulte l'historique:</b><br/>
    Admin ou agent SUIVI accède au dashboard de suivi<br/>
    Peut rechercher/filtrer demande #42:<br/>
    • Timeline complète: création → validation → réception<br/>
    • Tous les email events enregistrés<br/>
    • Révisions (si modifications)<br/>
    • Export en Excel pour reporting
    """
    story.append(Paragraph(scenario_text, body_style))
    story.append(PageBreak())
    
    story.append(Paragraph("10.2 Gestion des Erreurs et Cas Dégénérés", heading2_style))
    errors_text = """
    <b>Erreur 1 - TECHNICENTRE annule sa demande:</b><br/>
    Si status EN_COURS_DE_TRAITEMENT: TECHNICENTRE peut annuler directement<br/>
    → Demande passe à ANNULEE<br/>
    → Email REQUEST_CANCELLED envoyé<br/><br/>
    
    <b>Erreur 2 - PERMANENT annule la demande:</b><br/>
    Si status EN_COURS_DE_TRAITEMENT ou A_MODIFIER: PERMANENT peut annuler<br/>
    → Demande passe à ANNULEE<br/>
    → Email DECISION_CANCELLED avec motif envoyé<br/>
    → TECHNICENTRE peut consulter motif dans détails demande<br/><br/>
    
    <b>Erreur 3 - Matériel partiellement reçu:</b><br/>
    TECHNICENTRE récepteur confirme réception partielle<br/>
    → Demande passe à RECEPTION_PARTIELLE<br/>
    → Détails: quels matériaux manquants, quand attendus<br/>
    → Timeline indique état partiel<br/><br/>
    
    <b>Erreur 4 - Problème détecté à réception:</b><br/>
    TECHNICENTRE récepteur signale problème lors déballage<br/>
    → Demande passe à RECEPTION_PROBLEME_SIGNALE<br/>
    → Détails du problème enregistrés<br/>
    → Notification automatique PERMANENT et TECHNICENTRE demandeur
    """
    story.append(Paragraph(errors_text, body_style))
    story.append(Spacer(1, 0.5*cm))
    
    story.append(Paragraph("10.3 Contrôles de Sécurité", heading2_style))
    security_text = """
    • <b>Authentification JWT:</b> Toutes les requêtes sans JWT sont rejetées 401<br/>
    • <b>Autorisations de Rôle:</b> Chaque endpoint valide le rôle de l'utilisateur<br/>
    • <b>Scope d'Accès:</b> AGENT ne peut modifier que ses propres alertes<br/>
    • <b>ÉTABLISSEMENT:</b> Ne peut accéder qu'aux alertes orientées vers lui<br/>
    • <b>Hash Mots de Passe:</b> Jamais stockés en clair, utilisation bcrypt<br/>
    • <b>CORS:</b> Configuré pour accepter localhost et domaines autorisés<br/>
    • <b>Validation Données:</b> Pydantic valide toutes les entrées<br/>
    • <b>SQL Injection:</b> Protection via ORM SQLAlchemy (requêtes paramétrées)<br/>
    • <b>Upload Fichiers:</b> Validation MIME type, taille limite, stockage isolé
    """
    story.append(Paragraph(security_text, body_style))
    story.append(PageBreak())
    
    # ===== ANNEXES =====
    story.append(Paragraph("ANNEXES", heading1_style))
    story.append(Spacer(1, 0.3*cm))
    
    story.append(Paragraph("A. Endpoints API Principaux", heading2_style))
    endpoints_data = [
        ["Méthode", "Endpoint", "Description"],
        ["POST", "/auth/login", "Authentification utilisateur"],
        ["GET", "/me", "Profil utilisateur courant"],
        ["POST", "/alerts (demandes)", "Créer nouvelle demande d'acheminement"],
        ["GET", "/alerts (demandes)", "Lister demandes filtrées par rôle"],
        ["GET", "/alerts/{id} (demandes)", "Détails complets d'une demande"],
        ["PUT", "/alerts/{id} (demandes)", "Modifier demande (conditions: statut, auteur)"],
        ["POST", "/alerts/{id}/permanent-decision", "Décision PERMANENT (valider/annuler/modifier)"],
        ["POST", "/alerts/{id}/establishment-confirmation", "Confirmation réception TECHNICENTRE"],
        ["GET", "/establishments", "Lister technicentres"],
        ["GET", "/stations", "Lister gares"],
        ["POST", "/admin/users", "Créer nouvel utilisateur (ADMIN)"],
        ["PUT", "/admin/users/{id}", "Modifier utilisateur (ADMIN)"],
        ["DELETE", "/admin/users/{id}", "Supprimer utilisateur (ADMIN)"],
        ["GET", "/admin/export", "Exporter historique Excel (ADMIN)"],
    ]
    
    endpoints_table = Table(endpoints_data, colWidths=[1.5*cm, 3.2*cm, 9.3*cm])
    endpoints_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#1e3a8a')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, 0), 9),
        ('BOTTOMPADDING', (0, 0), (-1, 0), 10),
        ('GRID', (0, 0), (-1, -1), 1, colors.black),
        ('FONTSIZE', (0, 1), (-1, -1), 8),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#f0f0f0')]),
    ]))
    story.append(endpoints_table)
    story.append(PageBreak())
    
    story.append(Paragraph("B. Structure des Répertoires Backend", heading2_style))
    structure_text = """
    backend/<br/>
    ├── app/<br/>
    │   ├── main.py                 # FastAPI app + lifespan<br/>
    │   ├── seed.py                 # Seed données démo<br/>
    │   ├── api/                    # Routers<br/>
    │   │   ├── auth.py             # /auth endpoints<br/>
    │   │   ├── alerts.py           # /alerts CRUD + workflow<br/>
    │   │   ├── admin.py            # /admin gestion comptes<br/>
    │   │   ├── meta.py             # /stations, /establishments<br/>
    │   │   └── deps.py             # Dépendances FastAPI<br/>
    │   ├── core/<br/>
    │   │   ├── config.py           # Settings Pydantic<br/>
    │   │   ├── security.py         # JWT + hashing<br/>
    │   │   └── technicentres.py    # Listes références<br/>
    │   ├── db/<br/>
    │   │   ├── base.py             # Declarative Base<br/>
    │   │   ├── session.py          # Engine + get_db<br/>
    │   │   └── bootstrap.py        # Migrations SQL<br/>
    │   ├── models/<br/>
    │   │   ├── enums.py            # Enums (UserRole, Status, etc)<br/>
    │   │   ├── alert.py            # Modèles Alert + historiques<br/>
    │   │   ├── user.py             # Modèle User<br/>
    │   │   ├── establishment.py    # Modèle Establishment<br/>
    │   │   └── station.py          # Modèle Station<br/>
    │   ├── schemas/<br/>
    │   │   ├── auth.py             # Pydantic schemas auth<br/>
    │   │   ├── alert.py            # Pydantic schemas alert<br/>
    │   │   ├── admin.py            # Pydantic schemas admin<br/>
    │   │   ├── common.py           # Schemas communs<br/>
    │   │   └── notification.py     # Schemas notifications<br/>
    │   └── services/<br/>
    │       ├── alerts.py           # Helpers métier alertes<br/>
    │       ├── mailing.py          # Service emails SMTP<br/>
    │       ├── realtime.py         # WebSocket manager<br/>
    │       └── storage.py          # Sauvegarde fichiers<br/>
    ├── alembic/<br/>
    │   ├── env.py                  # Config Alembic<br/>
    │   └── versions/               # Migration files<br/>
    ├── uploads/                    # Fichiers uploadés<br/>
    ├── requirements.txt            # Dépendances Python<br/>
    ├── Dockerfile                  # Build image Docker<br/>
    └── alembic.ini                 # Config Alembic
    """
    story.append(Paragraph(structure_text, body_style))
    story.append(PageBreak())
    
    story.append(Paragraph("C. Comptes de Démonstration", heading2_style))
    
    demo_accounts = [
        ["Username", "Password", "Rôle", "Technicentre"],
        ["permanent", "pass123", "PERMANENT", "N/A"],
        ["admin", "pass123", "ADMIN", "N/A"],
        ["tech1", "pass123", "TECHNICENTRE", "Technicentre Casablanca"],
        ["tech2", "pass123", "TECHNICENTRE", "Technicentre Marrakech"],
        ["suivi", "pass123", "SUIVI", "N/A"],
    ]
    
    demo_table = Table(demo_accounts, colWidths=[3*cm, 2.5*cm, 3*cm, 5.5*cm])
    demo_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#1e3a8a')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, 0), 9),
        ('BOTTOMPADDING', (0, 0), (-1, 0), 10),
        ('GRID', (0, 0), (-1, -1), 1, colors.black),
        ('FONTSIZE', (0, 1), (-1, -1), 9),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#f0f0f0')]),
    ]))
    story.append(demo_table)
    story.append(Spacer(1, 0.5*cm))
    
    story.append(Paragraph("D. Notes de Configuration", heading2_style))
    config_text = """
    <b>Backend (.env):</b><br/>
    DATABASE_URL=sqlite:///./oncf_demo.db  # SQLite local<br/>
    JWT_SECRET_KEY=your-super-secret-key<br/>
    SMTP_HOST=smtp.gmail.com<br/>
    SMTP_PORT=587<br/>
    SMTP_USERNAME=your-email@gmail.com<br/>
    SMTP_PASSWORD=your-app-password<br/><br/>
    
    <b>Frontend (.env):</b><br/>
    VITE_API_URL=http://localhost:8000<br/><br/>
    
    <b>Docker Compose:</b><br/>
    Services définis: frontend, backend, postgres (optionnel)<br/>
    Volumes: BD persistante, uploads partagés<br/>
    Networks: communication inter-services
    """
    story.append(Paragraph(config_text, body_style))
    story.append(PageBreak())
    
    # Construire le PDF
    doc.build(story)
    print(f"✓ Documentation générée avec succès: {output_path}")
    print(f"  Fichier: Documentation_Technique_ONCF.pdf")
    print(f"  Taille: {output_path.stat().st_size / 1024:.1f} KB")
    return output_path

if __name__ == "__main__":
    create_documentation()
