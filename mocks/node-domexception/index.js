const DOMException = globalThis.DOMException || class DOMException extends Error {
  constructor(message, name) {
    super(message);
    this.name = name || "DOMException";
  }
};
export default DOMException;
