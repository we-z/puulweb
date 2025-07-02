const admin = require("firebase-admin");

/**
 * A generic function to retrieve data from the Firebase Realtime Database.
 * It now supports partial string matching for filters.
 * @param {object} params The parameters for the function call.
 * @param {string} params.dataType The top-level key for the data (e.g., 'workOrders', 'properties').
 * @param {object} [params.filters] Key-value pairs to filter the data.
 * @param {string} uid The user's UID to query the correct data path.
 * @returns {Promise<object>} A promise that resolves to the retrieved data.
 */
async function getData({ dataType, filters }, uid) {
    try {
        const db = admin.database();
        const dataRef = db.ref(`/${dataType}/${uid}`);

        // Get all data of the specified type first.
        const snapshot = await dataRef.once('value');
        const allData = snapshot.val();

        if (!allData) {
            return { result: `No data found for ${dataType}.` };
        }

        // If no filters are provided, return everything.
        if (!filters || Object.keys(filters).length === 0) {
            return { result: allData, count: Object.keys(allData).length };
        }

        // If filters are provided, filter the data on the server.
        const allDataWithIds = Object.entries(allData).map(([id, value]) => ({ ...value, id }));
        
        const filteredData = allDataWithIds.filter(item => {
            return Object.entries(filters).every(([key, filterValue]) => {
                const itemValue = item[key];
                if (itemValue === undefined || itemValue === null) {
                    return false;
                }
                // Perform case-insensitive partial match for strings.
                if (typeof itemValue === 'string' && typeof filterValue === 'string') {
                    return itemValue.toLowerCase().includes(filterValue.toLowerCase());
                }
                // Perform an exact match for other types (numbers, booleans).
                return itemValue === filterValue;
            });
        });
        
        if (filteredData.length === 0) {
            return { result: `No ${dataType} found matching the criteria.` };
        }

        return { result: filteredData, count: filteredData.length };

    } catch (error) {
        console.error(`Error in getData for dataType ${dataType}:`, error);
        return { error: `Failed to retrieve data. Details: ${error.message}` };
    }
}

/**
 * A generic function to update data in the Firebase Realtime Database.
 * @param {object} params The parameters for the function call.
 * @param {string} params.dataType The top-level key for the data.
 * @param {string} params.itemId The ID of the item to update.
 * @param {object} params.updates The key-value pairs to update.
 * @param {string} uid The user's UID.
 * @returns {Promise<object>} A promise that resolves to a success or error message.
 */
async function updateData({ dataType, itemId, updates }, uid) {
    try {
        const db = admin.database();
        const itemRef = db.ref(`/${dataType}/${uid}/${itemId}`);
        
        // Add a timestamp for when the record was last updated
        updates.updatedAt = admin.database.ServerValue.TIMESTAMP;

        await itemRef.update(updates);
        return { result: `Successfully updated ${dataType} with ID ${itemId}.` };
    } catch (error) {
        console.error(`Error in updateData for dataType ${dataType}:`, error);
        return { error: `Failed to update data. Details: ${error.message}` };
    }
}


// This map holds the actual functions that will be executed.
const toolImplementations = {
    getData,
    updateData,
    // You can add createData and deleteData here in the future.
};

module.exports = { toolImplementations }; 