import { Languages } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LANGUAGES, setLang, useLang } from "@/i18n";
import type { Lang } from "@/types";

export function LanguageSwitcher() {
  const lang = useLang();
  return (
    <Select value={lang} onValueChange={(v) => setLang(v as Lang)}>
      <SelectTrigger className="h-9 w-auto min-w-[150px] gap-2 bg-card" aria-label="Interface language">
        <Languages className="h-4 w-4 text-primary" />
        <SelectValue />
      </SelectTrigger>
      <SelectContent align="end">
        {LANGUAGES.map((l) => (
          <SelectItem key={l.code} value={l.code}>{l.native}<span className="ml-1 text-xs text-muted-foreground">· {l.label}</span></SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
