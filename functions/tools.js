const admin = require("firebase-admin");

/**
 * A generic function to retrieve data from the Firebase Realtime Database.
 * @param {object} params The parameters for the function call.
 * @param {string} params.dataType The top-level key for the data (e.g., 'workOrders', 'properties').
 * @param {object} [params.filters] Key-value pairs to filter the data.
 * @param {string} uid The user's UID to query the correct data path.
 * @returns {Promise<object>} A promise that resolves to the retrieved data.
 */
async function getData({ dataType, filters }, uid) {
    try {
        const db = admin.database();
        let dataRef = db.ref(`/${dataType}/${uid}`);

        if (filters && Object.keys(filters).length > 0) {
            // This is a simplified filtering mechanism. For more complex queries,
            // you might need to adjust this. It assumes the first filter is the primary one.
            const [field, value] = Object.entries(filters)[0];
            dataRef = dataRef.orderByChild(field).equalTo(value);
        }

        const snapshot = await dataRef.once('value');
        const data = snapshot.val();

        if (!data) {
            return { result: `No data found for ${dataType} with the specified filters.` };
        }
        
        // If multiple filters were intended, apply the rest on the backend
        if (filters && Object.keys(filters).length > 1) {
             const allData = Object.values(data);
             const filteredData = allData.filter(item => {
                 return Object.entries(filters).every(([key, val]) => item[key] === val);
             });
             return { result: filteredData, count: filteredData.length };
        }
        
        return { result: data, count: Object.keys(data).length };
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