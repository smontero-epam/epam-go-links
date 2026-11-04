type SearchBoxProps = {
  value: string;
  onChange: (value: string) => void;
};

export function SearchBox({ value, onChange }: SearchBoxProps) {
  return (
    <div className="field search">
      <label htmlFor="search">Search shortcuts</label>
      <p id="search-hint" className="field-hint">
        Matches the name, destination or description.
      </p>
      <input
        id="search"
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        aria-describedby="search-hint"
        autoComplete="off"
        spellCheck={false}
      />
    </div>
  );
}
