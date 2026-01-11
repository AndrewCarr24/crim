
export async function fetchBookContent() {
    // Local Full Text File
    const url = 'assets/text/gatsby.txt';

    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Failed to fetch book: ${response.statusText}`);
        }
        const text = await response.text();

        // Simple parsing to start after the header if present
        const startMarker = "*** START OF THE PROJECT GUTENBERG EBOOK THE GREAT GATSBY ***";
        const idx = text.indexOf(startMarker);
        if (idx !== -1) {
            return text.substring(idx + startMarker.length);
        }
        return text;
    } catch (error) {
        console.warn('Book fetch failed:', error);
        return "Error loading book content. Please check if assets/text/gatsby.txt exists.";
    }
}
