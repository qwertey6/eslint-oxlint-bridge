async function fetchData(): Promise<string> {
  return "data";
}

// This should trigger no-floating-promises
fetchData();
