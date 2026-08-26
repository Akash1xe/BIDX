"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Combobox, ComboboxContent, ComboboxEmpty, ComboboxInput, ComboboxItem, ComboboxList } from "@/components/ui/combobox";
import useDebounce from "@/hooks/useDebounce";
import { useSearchSuggestions } from "@/features/search/hooks";

function suggestionLabel(item) {
  if (typeof item === "string") return item;
  return item?.text || item?.name || item?.label || "";
}

export default function SearchAutocomplete({ defaultValue = "", compact = false }) {
  const router = useRouter();
  const [query, setQuery] = useState(defaultValue);
  const debounced = useDebounce(query, 300);
  const suggestions = useSearchSuggestions(debounced);
  const items = useMemo(() => (suggestions.data?.suggestions || []).map(suggestionLabel).filter(Boolean), [suggestions.data]);

  function go(value = query) {
    const next = value.trim();
    router.push(next ? `/search?q=${encodeURIComponent(next)}` : "/search");
  }

  return (
    <form className={`search-combobox ${compact ? "search-combobox-compact" : ""}`} onSubmit={(event) => { event.preventDefault(); go(); }}>
      <Search className="search-leading" />
      <Combobox items={items} inputValue={query} onInputValueChange={setQuery} onValueChange={(value) => value && go(String(value))}>
        <ComboboxInput placeholder="Search cameras, watches, collectibles…" showTrigger={false} showClear className="search-combobox-input" aria-label="Search auctions" />
        {query.trim().length >= 2 && (
          <ComboboxContent className="search-suggestions">
            <ComboboxList>
              {suggestions.isLoading && <div className="suggestion-loading"><LoaderCircle className="spin" /> Finding matches…</div>}
              {items.map((item) => <ComboboxItem key={item} value={item}><Search />{item}</ComboboxItem>)}
              {!suggestions.isLoading && <ComboboxEmpty>No suggestions found</ComboboxEmpty>}
            </ComboboxList>
          </ComboboxContent>
        )}
      </Combobox>
      <Button type="submit" className="primary-button">Search</Button>
    </form>
  );
}

