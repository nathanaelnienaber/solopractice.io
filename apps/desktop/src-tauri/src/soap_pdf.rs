//! SOAP note PDF export
//!
//! Renders a single session's finalized SOAP note to a PDF file on local
//! disk, for the therapist to print or file. Reuses the same `printpdf`
//! document pipeline as `superbill.rs` (same crate, same page setup, same
//! font-loading pattern) instead of pulling in a second PDF library --
//! the two modules just render different clinical documents.
//!
//! No network calls. The PDF never leaves this device except by the
//! user's own manual action (print / move the file).

use printpdf::*;
use std::fs::File;
use std::io::BufWriter;
use std::path::Path;

#[derive(Debug, Clone)]
pub struct SoapPdfData {
    pub client_name: String,
    pub session_id: String,
    pub session_date: String,
    pub subjective: String,
    pub objective: String,
    pub assessment: String,
    pub plan: String,
    pub signed_at: Option<String>,
    pub signed_by: Option<String>,
}

pub fn generate_soap_pdf(data: &SoapPdfData, output_path: &Path) -> Result<(), String> {
    let (doc, page1, layer1) = PdfDocument::new(
        "SOAP Note",
        Mm(215.9), // Letter width
        Mm(279.4), // Letter height
        "Layer 1",
    );

    let current_layer = doc.get_page(page1).get_layer(layer1);

    let font = doc
        .add_builtin_font(BuiltinFont::Helvetica)
        .map_err(|e| format!("Failed to load font: {}", e))?;
    let font_bold = doc
        .add_builtin_font(BuiltinFont::HelveticaBold)
        .map_err(|e| format!("Failed to load bold font: {}", e))?;

    let page_width = Mm(215.9);
    let margin = Mm(20.0);
    let max_width_chars = 95usize;
    let mut y_pos = Mm(260.0);

    // === TITLE ===
    current_layer.use_text("SOAP NOTE", 18.0, margin, y_pos, &font_bold);
    y_pos = y_pos - Mm(9.0);

    // === HEADER INFO ===
    current_layer.use_text(&format!("Client: {}", data.client_name), 11.0, margin, y_pos, &font);
    y_pos = y_pos - Mm(5.5);
    current_layer.use_text(
        &format!("Session Date: {}", data.session_date),
        11.0,
        margin,
        y_pos,
        &font,
    );
    y_pos = y_pos - Mm(5.5);
    current_layer.use_text(
        &format!("Session ID: {}", data.session_id),
        9.0,
        margin,
        y_pos,
        &font,
    );
    y_pos = y_pos - Mm(9.0);

    // Divider
    let line = Line {
        points: vec![
            (Point::new(margin, y_pos), false),
            (Point::new(page_width - margin, y_pos), false),
        ],
        is_closed: false,
    };
    current_layer.add_line(line);
    y_pos = y_pos - Mm(8.0);

    fn draw_section(
        layer: &PdfLayerReference,
        font: &IndirectFontRef,
        font_bold: &IndirectFontRef,
        margin: Mm,
        max_width_chars: usize,
        label: &str,
        content: &str,
        y: Mm,
    ) -> Mm {
        let mut y_pos = y;
        layer.use_text(label, 12.0, margin, y_pos, font_bold);
        y_pos = y_pos - Mm(6.0);
        if content.trim().is_empty() {
            layer.use_text("(none recorded)", 10.0, margin, y_pos, font);
            y_pos = y_pos - Mm(6.0);
        } else {
            for line in wrap_text(content, max_width_chars) {
                layer.use_text(&line, 10.0, margin, y_pos, font);
                y_pos = y_pos - Mm(5.0);
            }
        }
        y_pos - Mm(4.0)
    }

    y_pos = draw_section(
        &current_layer,
        &font,
        &font_bold,
        margin,
        max_width_chars,
        "S - Subjective",
        &data.subjective,
        y_pos,
    );
    y_pos = draw_section(
        &current_layer,
        &font,
        &font_bold,
        margin,
        max_width_chars,
        "O - Objective",
        &data.objective,
        y_pos,
    );
    y_pos = draw_section(
        &current_layer,
        &font,
        &font_bold,
        margin,
        max_width_chars,
        "A - Assessment",
        &data.assessment,
        y_pos,
    );
    y_pos = draw_section(
        &current_layer,
        &font,
        &font_bold,
        margin,
        max_width_chars,
        "P - Plan",
        &data.plan,
        y_pos,
    );

    // === SIGNATURE ===
    y_pos = y_pos - Mm(4.0);
    let line = Line {
        points: vec![
            (Point::new(margin, y_pos), false),
            (Point::new(page_width - margin, y_pos), false),
        ],
        is_closed: false,
    };
    current_layer.add_line(line);
    y_pos = y_pos - Mm(6.0);

    match (&data.signed_by, &data.signed_at) {
        (Some(by), Some(at)) => {
            current_layer.use_text(
                &format!("Signed by: {}  on  {}", by, at),
                9.0,
                margin,
                y_pos,
                &font,
            );
        }
        _ => {
            current_layer.use_text(
                "This note has not been signed/finalized.",
                9.0,
                margin,
                y_pos,
                &font,
            );
        }
    }

    let file = File::create(output_path).map_err(|e| format!("Failed to create file: {}", e))?;
    let mut writer = BufWriter::new(file);
    doc.save(&mut writer)
        .map_err(|e| format!("Failed to save PDF: {}", e))?;

    Ok(())
}

/// Naive word-wrap so long SOAP text doesn't run off the page edge.
/// Good enough for a monospaced-ish fixed character budget per line;
/// this is a plain clinical text document, not a typeset layout.
fn wrap_text(text: &str, max_chars: usize) -> Vec<String> {
    let mut lines = Vec::new();
    for raw_line in text.lines() {
        if raw_line.is_empty() {
            lines.push(String::new());
            continue;
        }
        let mut current = String::new();
        for word in raw_line.split_whitespace() {
            if current.is_empty() {
                current.push_str(word);
            } else if current.len() + 1 + word.len() <= max_chars {
                current.push(' ');
                current.push_str(word);
            } else {
                lines.push(current);
                current = word.to_string();
            }
        }
        if !current.is_empty() {
            lines.push(current);
        }
    }
    lines
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::PathBuf;

    #[test]
    fn test_generate_soap_pdf() {
        let data = SoapPdfData {
            client_name: "Jane Doe".to_string(),
            session_id: "11111111-1111-1111-1111-111111111111".to_string(),
            session_date: "2026-09-15".to_string(),
            subjective: "Client reports improved mood.".to_string(),
            objective: "Alert, oriented, affect congruent.".to_string(),
            assessment: "Adjustment disorder, improving.".to_string(),
            plan: "Continue weekly sessions.".to_string(),
            signed_at: Some("2026-09-15T18:00:00Z".to_string()),
            signed_by: Some("Dr. Jane Smith, LMHC".to_string()),
        };

        let output = PathBuf::from("/tmp/test_soap_note.pdf");
        let result = generate_soap_pdf(&data, &output);
        assert!(result.is_ok(), "Failed: {:?}", result);
        assert!(output.exists());
    }
}
