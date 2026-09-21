//! Superbill PDF Generation
//!
//! Generates professional superbill PDFs for insurance reimbursement.
//! All data stays local - superbills contain clinical codes (Dx, CPT).

use printpdf::*;
use std::fs::File;
use std::io::BufWriter;
use std::path::Path;

#[derive(Debug, Clone)]
pub struct TherapistInfo {
    pub practice_name: String,
    pub therapist_name: String,
    pub credentials: String,
    pub npi_number: Option<String>,
    pub tax_id: Option<String>,
    pub address_street: String,
    pub address_city: String,
    pub address_state: String,
    pub address_zip: String,
    pub phone: Option<String>,
}

#[derive(Debug, Clone)]
pub struct ClientInfo {
    pub name: String,
    pub address: Option<String>,
    pub phone: Option<String>,
    pub date_of_birth: Option<String>,
}

#[derive(Debug, Clone)]
pub struct ServiceLine {
    pub date: String,
    pub cpt_code: String,
    pub cpt_description: String,
    pub diagnosis_pointer: String,
    pub units: u32,
    pub charge_cents: u32,
}

#[derive(Debug, Clone)]
pub struct SuperbillData {
    pub therapist: TherapistInfo,
    pub client: ClientInfo,
    pub diagnosis_codes: Vec<(String, String)>, // (code, description)
    pub services: Vec<ServiceLine>,
    pub invoice_number: String,
    pub invoice_date: String,
}

pub fn generate_superbill_pdf(data: &SuperbillData, output_path: &Path) -> Result<(), String> {
    let (doc, page1, layer1) = PdfDocument::new(
        "Superbill",
        Mm(215.9),  // Letter width
        Mm(279.4),  // Letter height
        "Layer 1",
    );

    let current_layer = doc.get_page(page1).get_layer(layer1);

    // Load built-in font
    let font = doc.add_builtin_font(BuiltinFont::Helvetica)
        .map_err(|e| format!("Failed to load font: {}", e))?;
    let font_bold = doc.add_builtin_font(BuiltinFont::HelveticaBold)
        .map_err(|e| format!("Failed to load bold font: {}", e))?;

    let page_width = Mm(215.9);
    let margin = Mm(20.0);
    let mut y_pos = Mm(260.0);

    // === HEADER: Practice Info ===
    current_layer.use_text(
        &data.therapist.practice_name,
        16.0,
        margin,
        y_pos,
        &font_bold,
    );
    y_pos = y_pos - Mm(6.0);

    let therapist_line = format!(
        "{}, {}",
        data.therapist.therapist_name,
        data.therapist.credentials
    );
    current_layer.use_text(&therapist_line, 10.0, margin, y_pos, &font);
    y_pos = y_pos - Mm(4.5);

    current_layer.use_text(&data.therapist.address_street, 10.0, margin, y_pos, &font);
    y_pos = y_pos - Mm(4.5);

    let city_line = format!(
        "{}, {} {}",
        data.therapist.address_city,
        data.therapist.address_state,
        data.therapist.address_zip
    );
    current_layer.use_text(&city_line, 10.0, margin, y_pos, &font);
    y_pos = y_pos - Mm(4.5);

    if let Some(phone) = &data.therapist.phone {
        current_layer.use_text(&format!("Phone: {}", phone), 10.0, margin, y_pos, &font);
        y_pos = y_pos - Mm(4.5);
    }

    if let Some(npi) = &data.therapist.npi_number {
        current_layer.use_text(&format!("NPI: {}", npi), 10.0, margin, y_pos, &font);
        y_pos = y_pos - Mm(4.5);
    }

    if let Some(tax_id) = &data.therapist.tax_id {
        current_layer.use_text(&format!("Tax ID: {}", tax_id), 10.0, margin, y_pos, &font);
    }

    // === TITLE ===
    y_pos = Mm(215.0);
    let title_x = page_width / 2.0 - Mm(20.0);
    current_layer.use_text("SUPERBILL", 18.0, title_x, y_pos, &font_bold);

    // Invoice info on right side
    let right_col = page_width - margin - Mm(50.0);
    current_layer.use_text(
        &format!("Invoice #: {}", data.invoice_number),
        10.0,
        right_col,
        Mm(260.0),
        &font,
    );
    current_layer.use_text(
        &format!("Date: {}", data.invoice_date),
        10.0,
        right_col,
        Mm(255.5),
        &font,
    );

    // === CLIENT INFO ===
    y_pos = Mm(200.0);
    current_layer.use_text("PATIENT INFORMATION", 11.0, margin, y_pos, &font_bold);
    y_pos = y_pos - Mm(6.0);

    current_layer.use_text(&format!("Name: {}", data.client.name), 10.0, margin, y_pos, &font);
    y_pos = y_pos - Mm(4.5);

    if let Some(dob) = &data.client.date_of_birth {
        current_layer.use_text(&format!("DOB: {}", dob), 10.0, margin, y_pos, &font);
        y_pos = y_pos - Mm(4.5);
    }

    if let Some(address) = &data.client.address {
        current_layer.use_text(&format!("Address: {}", address), 10.0, margin, y_pos, &font);
        y_pos = y_pos - Mm(4.5);
    }

    if let Some(phone) = &data.client.phone {
        current_layer.use_text(&format!("Phone: {}", phone), 10.0, margin, y_pos, &font);
    }

    // === DIAGNOSIS CODES ===
    y_pos = Mm(165.0);
    current_layer.use_text("DIAGNOSIS CODES", 11.0, margin, y_pos, &font_bold);
    y_pos = y_pos - Mm(6.0);

    for (i, (code, description)) in data.diagnosis_codes.iter().enumerate() {
        let label = format!("{}. {} - {}", (b'A' + i as u8) as char, code, description);
        current_layer.use_text(&label, 10.0, margin, y_pos, &font);
        y_pos = y_pos - Mm(4.5);
    }

    // === SERVICE TABLE ===
    y_pos = y_pos - Mm(8.0);
    current_layer.use_text("SERVICES RENDERED", 11.0, margin, y_pos, &font_bold);
    y_pos = y_pos - Mm(6.0);

    // Table headers
    let col_date = margin;
    let col_cpt = margin + Mm(25.0);
    let col_desc = margin + Mm(50.0);
    let col_dx = margin + Mm(110.0);
    let col_units = margin + Mm(130.0);
    let col_charge = margin + Mm(150.0);

    current_layer.use_text("Date", 9.0, col_date, y_pos, &font_bold);
    current_layer.use_text("CPT", 9.0, col_cpt, y_pos, &font_bold);
    current_layer.use_text("Description", 9.0, col_desc, y_pos, &font_bold);
    current_layer.use_text("Dx", 9.0, col_dx, y_pos, &font_bold);
    current_layer.use_text("Units", 9.0, col_units, y_pos, &font_bold);
    current_layer.use_text("Charge", 9.0, col_charge, y_pos, &font_bold);

    // Draw line under headers
    y_pos = y_pos - Mm(2.0);
    let line = Line {
        points: vec![
            (Point::new(margin, y_pos), false),
            (Point::new(page_width - margin, y_pos), false),
        ],
        is_closed: false,
    };
    current_layer.add_line(line);

    y_pos = y_pos - Mm(5.0);

    // Service rows
    let mut total_cents: u32 = 0;
    for service in &data.services {
        current_layer.use_text(&service.date, 9.0, col_date, y_pos, &font);
        current_layer.use_text(&service.cpt_code, 9.0, col_cpt, y_pos, &font);
        
        // Truncate description if too long
        let desc = if service.cpt_description.len() > 30 {
            format!("{}...", &service.cpt_description[..27])
        } else {
            service.cpt_description.clone()
        };
        current_layer.use_text(&desc, 9.0, col_desc, y_pos, &font);
        
        current_layer.use_text(&service.diagnosis_pointer, 9.0, col_dx, y_pos, &font);
        current_layer.use_text(&service.units.to_string(), 9.0, col_units, y_pos, &font);
        
        let charge = format!("${:.2}", service.charge_cents as f64 / 100.0);
        current_layer.use_text(&charge, 9.0, col_charge, y_pos, &font);
        
        total_cents += service.charge_cents * service.units;
        y_pos = y_pos - Mm(5.0);
    }

    // Total line
    y_pos = y_pos - Mm(2.0);
    let line = Line {
        points: vec![
            (Point::new(col_units, y_pos), false),
            (Point::new(page_width - margin, y_pos), false),
        ],
        is_closed: false,
    };
    current_layer.add_line(line);

    y_pos = y_pos - Mm(5.0);
    current_layer.use_text("TOTAL:", 10.0, col_units, y_pos, &font_bold);
    let total = format!("${:.2}", total_cents as f64 / 100.0);
    current_layer.use_text(&total, 10.0, col_charge, y_pos, &font_bold);

    // === FOOTER ===
    let footer_y = Mm(30.0);
    current_layer.use_text(
        "This superbill is provided for insurance reimbursement purposes.",
        8.0,
        margin,
        footer_y,
        &font,
    );
    current_layer.use_text(
        "Please submit to your insurance company for possible reimbursement.",
        8.0,
        margin,
        footer_y - Mm(4.0),
        &font,
    );

    // Signature line
    current_layer.use_text(
        "Provider Signature: _______________________________  Date: _______________",
        9.0,
        margin,
        Mm(50.0),
        &font,
    );

    // Save PDF
    let file = File::create(output_path)
        .map_err(|e| format!("Failed to create file: {}", e))?;
    let mut writer = BufWriter::new(file);
    
    doc.save(&mut writer)
        .map_err(|e| format!("Failed to save PDF: {}", e))?;

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::PathBuf;

    #[test]
    fn test_generate_superbill() {
        let data = SuperbillData {
            therapist: TherapistInfo {
                practice_name: "Healing Minds Therapy".to_string(),
                therapist_name: "Dr. Jane Smith".to_string(),
                credentials: "LMHC".to_string(),
                npi_number: Some("1234567890".to_string()),
                tax_id: Some("12-3456789".to_string()),
                address_street: "123 Therapy Lane".to_string(),
                address_city: "Tampa".to_string(),
                address_state: "FL".to_string(),
                address_zip: "33601".to_string(),
                phone: Some("(813) 555-1234".to_string()),
            },
            client: ClientInfo {
                name: "John Doe".to_string(),
                address: Some("456 Client St, Tampa, FL 33602".to_string()),
                phone: Some("(813) 555-5678".to_string()),
                date_of_birth: Some("01/15/1985".to_string()),
            },
            diagnosis_codes: vec![
                ("F41.1".to_string(), "Generalized Anxiety Disorder".to_string()),
                ("F32.1".to_string(), "Major Depressive Disorder, moderate".to_string()),
            ],
            services: vec![
                ServiceLine {
                    date: "09/15/2026".to_string(),
                    cpt_code: "90834".to_string(),
                    cpt_description: "Psychotherapy, 45 min".to_string(),
                    diagnosis_pointer: "A,B".to_string(),
                    units: 1,
                    charge_cents: 15000,
                },
            ],
            invoice_number: "SB-2026-001".to_string(),
            invoice_date: "09/15/2026".to_string(),
        };

        let output = PathBuf::from("/tmp/test_superbill.pdf");
        let result = generate_superbill_pdf(&data, &output);
        assert!(result.is_ok(), "Failed: {:?}", result);
        assert!(output.exists());
    }
}
