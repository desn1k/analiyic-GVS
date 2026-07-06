// Маленькая иконка «?» с всплывающей подсказкой — для пояснения терминов.
export default function Hint({ text }) {
  return (
    <span className="hint" tabIndex={0}>
      ?<span className="hint-bubble">{text}</span>
    </span>
  );
}
