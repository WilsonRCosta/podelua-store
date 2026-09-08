async function fetchProducts() {
    const response = await fetch('/api/products');

    if (!response.ok) {
        throw new Error(`Failed to fetch products: ${response.status}`);
    }

    return response.json();
}