// Chem price lookup API for chem_lookup questions

const WORKER_URL = 'https://misty-waterfall-054f.up1107677.workers.dev'; // Change to your deployed Worker URL if needed

/**
 * Looks up the cheapest price per gram for a chemical name.
 * @param {string} name - Chemical name or identifier
 * @param {string} [country='US'] - Country code (default US)
 * @returns {Promise<{success: boolean, price?: number, vendor?: string, pack?: number, uom?: string, link?: string, error?: string}>}
 */
export async function lookupChemicalPrice(name, country = 'US', unit = 'g') {
	if (!name || !name.trim()) {
		return { success: false, error: 'No chemical name provided.' };
	}
	try {
		const url = `${WORKER_URL}?query=${encodeURIComponent(name)}&shipToCountry=${encodeURIComponent(country)}&unit=${encodeURIComponent(unit)}`;
		const resp = await fetch(url);
		if (!resp.ok) {
			return { success: false, error: `Network error (${resp.status})` };
		}
		const data = await resp.json();
		if (data.success) {
			return {
				success: true,
				price: unit === 'ml' ? data.cheapestPricePerMl : data.cheapestPricePerGram,
				vendor: data.vendorName,
				pack: data.pack,
				uom: data.uom,
				link: data.link,
				unit: data.unit
			};
		} else {
			return { success: false, error: data.message || 'No price found.', unit: data.unit };
		}
	} catch (err) {
		return { success: false, error: 'Lookup failed: ' + err.message };
	}
}
