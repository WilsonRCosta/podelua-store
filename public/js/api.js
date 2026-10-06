async function getProducts() {
    const response = await fetch('/api/products');

    if (!response.ok) {
        throw new Error(`Failed to fetch products: ${response.status}`);
    }

    return response.json();
}

async function createOrder(payload) {
    const response = await fetch('/api/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    });

    const data = await response.json();

    if (!response.ok) {
        throw new Error(data.error || `Failed to create order: ${response.status}`);
    }

    return data;
}