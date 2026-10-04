import type { OfficialText, RuleRecord } from "./schema";

// Citation style, from our lawyer's cite-check: a citation is code + section (plus
// the ordinance or chapter in brackets), and each code goes by one name.
const NAMES: [RegExp, string][] = [
  [/\bLAMC\b/g, "L.A. Mun. Code"],
  [/\bLos Angeles Municipal Code\b/g, "L.A. Mun. Code"],
  [/\bS\.D\. Mun\. Code\b/g, "San Diego Mun. Code"],
  [/\bSan Diego Municipal Code\b/g, "San Diego Mun. Code"],
  [/\bBerkeley Municipal Code\b/g, "Berkeley Mun. Code"],
  [/\bBMC\b/g, "Berkeley Mun. Code"],
  [/\bCambridge Municipal Code\b/g, "Cambridge Mun. Code"],
  [/\bSan Francisco Administrative Code\b/g, "S.F. Admin. Code"],
  [/\bSanta Ana Municipal Code\b/g, "Santa Ana Mun. Code"],
  [/\bJersey City Mun(?:icipal|\.) Code\b/g, "Jersey City Code"],
  [/\bRAC Regulations\b/g, "Rent Adjustment Commission Regulations"],
];

export function standardize(citation: string): string {
  return NAMES.reduce((c, [re, name]) => c.replace(re, name), citation)
    .replace(/[–—]/g, "-")
    .replace(/\s{2,}/g, " ")
    .trim();
}

// What scripts/citecheck.ts decided for one card. It applies only while the card's
// citation is still the one the check saw, so a rerun of extraction can't pick up
// a stale answer.
export type CiteCheckEntry = {
  from_citation: string;
  citation: string;
  title: string | null;
  official_text: OfficialText | null;
  note: string | null;
  history?: string | null; // what the official code's history notes say about the cited section's dates
  condition?: string | null; // who qualifies, from the law's own text, when the card leaves it out
};

export function applyCiteCheck(rules: RuleRecord[], checked: Record<string, CiteCheckEntry> | null): RuleRecord[] {
  return rules.map((r) => {
    const c = checked?.[r.team_rule_id];
    const out = { ...r, citation: standardize(r.citation) };
    if (!c || (c.from_citation !== r.citation && c.citation !== r.citation)) return out;
    // Our consolidation flags a state rule stated only on a city page; a quote from the
    // statute itself settles that, so the flag goes and the note says what settled it.
    const cityPage = /Stated on a city agency's page[^.]*\.[^.]*official state source\./;
    if (c.official_text && cityPage.test(r.conflict_note ?? "")) {
      const rest = (r.conflict_note ?? "").replace(cityPage, "").trim();
      out.conflict_note = rest || null;
      out.conflict_flag = Boolean(rest);
      out.citation_note = [out.citation_note, `Checked against the statute's own text (${c.official_text.doc_id}).`].filter(Boolean).join(" ");
    }
    return {
      ...out,
      citation: standardize(c.citation),
      title: c.title ?? r.title,
      official_text: c.official_text,
      official_condition: c.condition ?? null,
      citation_note: [c.note, c.history, out.citation_note].filter(Boolean).join(" ") || null,
      // On a card already flagged for a date dispute, the code's own history note goes in the reviewer note.
      conflict_note:
        c.history && r.conflict_flag && /effective date/i.test(r.conflict_note ?? "") && !(r.conflict_note ?? "").includes(c.history)
          ? `${r.conflict_note} ${c.history}`
          : out.conflict_note,
    };
  });
}
