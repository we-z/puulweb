const admin = require("firebase-admin");

/**
 * A generic function to retrieve data from the Firebase Realtime Database.
 * It now supports complex filtering with multiple operators.
 * @param {object} params The parameters for the function call.
 * @param {string} params.dataType The top-level key for the data (e.g., 'workOrders', 'properties').
 * @param {Array<object>} [params.filters] An array of filter objects, e.g., [{field: 'status', operator: 'eq', value: 'Open'}].
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

        const allDataWithIds = Object.entries(allData).map(([id, value]) => ({ ...value, id }));

        // If no filters are provided, or filters is not a valid array, return everything.
        if (!filters || !Array.isArray(filters) || filters.length === 0) {
            return { result: allDataWithIds, count: allDataWithIds.length };
        }

        // If filters are provided, filter the data on the server.
        const filteredData = allDataWithIds.filter(item => {
            // 'every' implements an AND logic between all filters.
            return filters.every(filter => {
                const { field, operator, value: filterValue } = filter;
                const itemValue = item[field];

                if (itemValue === undefined || itemValue === null) {
                    // If the field doesn't exist on the item, it can't be equal, greater, or less than a value.
                    // It can be considered "not equal" or "not contains".
                    return operator === 'neq' || operator === 'notContains';
                }
                
                switch (operator) {
                    case 'eq':
                        if (typeof itemValue === 'string' && typeof filterValue === 'string') {
                            return itemValue.toLowerCase() === filterValue.toLowerCase();
                        }
                        return itemValue === filterValue;
                    case 'neq':
                        if (typeof itemValue === 'string' && typeof filterValue === 'string') {
                            return itemValue.toLowerCase() !== filterValue.toLowerCase();
                        }
                        return itemValue !== filterValue;
                    case 'gt':
                        return typeof itemValue === 'number' && typeof filterValue === 'number' && itemValue > filterValue;
                    case 'gte':
                        return typeof itemValue === 'number' && typeof filterValue === 'number' && itemValue >= filterValue;
                    case 'lt':
                        return typeof itemValue === 'number' && typeof filterValue === 'number' && itemValue < filterValue;
                    case 'lte':
                        return typeof itemValue === 'number' && typeof filterValue === 'number' && itemValue <= filterValue;
                    case 'contains':
                        if (typeof itemValue !== 'string' || typeof filterValue !== 'string') return false;
                        return itemValue.toLowerCase().includes(filterValue.toLowerCase());
                    case 'notContains':
                         if (typeof itemValue !== 'string' || typeof filterValue !== 'string') return false;
                        return !itemValue.toLowerCase().includes(filterValue.toLowerCase());
                    default:
                        console.warn(`Unknown filter operator: ${operator}`);
                        return false; 
                }
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

/**
 * A generic function to create a new data record in the Firebase Realtime Database.
 * @param {object} params The parameters for the function call.
 * @param {string} params.dataType The top-level key for the data.
 * @param {object} params.newData The data for the new record.
 * @param {string} uid The user's UID.
 * @returns {Promise<object>} A promise that resolves to the new item's ID or an error message.
 */
async function createData({ dataType, newData }, uid) {
    try {
        const db = admin.database();
        const listRef = db.ref(`/${dataType}/${uid}`);
        
        // Add timestamps for creation and update
        const timestamp = admin.database.ServerValue.TIMESTAMP;
        newData.createdAt = timestamp;
        newData.updatedAt = timestamp;

        if (dataType === 'workOrders') {
            const snapshot = await listRef.once('value');
            const allWorkOrders = snapshot.val() || {};
            let maxId = 0;
            Object.keys(allWorkOrders).forEach(id => {
                if (id.toLowerCase().startsWith('wo_')) {
                    const numPart = parseInt(id.substring(3), 10);
                    if (!isNaN(numPart) && numPart > maxId) {
                        maxId = numPart;
                    }
                }
            });
            const newWorkOrderId = `wo_${maxId + 1}`;
            const newItemRef = db.ref(`/${dataType}/${uid}/${newWorkOrderId}`);
            await newItemRef.set(newData);
            return { result: `Successfully created new ${dataType} with ID ${newWorkOrderId}.`, newItemId: newWorkOrderId };
        }

        const newItemRef = listRef.push();
        await newItemRef.set(newData);
        
        return { result: `Successfully created new ${dataType} with ID ${newItemRef.key}.`, newItemId: newItemRef.key };
    } catch (error) {
        console.error(`Error in createData for dataType ${dataType}:`, error);
        return { error: `Failed to create new data. Details: ${error.message}` };
    }
}

/**
 * A generic function to delete a data record from the Firebase Realtime Database.
 * @param {object} params The parameters for the function call.
 * @param {string} params.dataType The top-level key for the data.
 * @param {string} params.itemId The ID of the item to delete.
 * @param {string} uid The user's UID.
 * @returns {Promise<object>} A promise that resolves to a success or error message.
 */
async function deleteData({ dataType, itemId }, uid) {
    try {
        const db = admin.database();
        const itemRef = db.ref(`/${dataType}/${uid}/${itemId}`);
        
        await itemRef.remove();
        return { result: `Successfully deleted ${dataType} with ID ${itemId}.` };
    } catch (error) {
        console.error(`Error in deleteData for dataType ${dataType}:`, error);
        return { error: `Failed to delete data. Details: ${error.message}` };
    }
}


// This map holds the actual functions that will be executed.
const toolImplementations = {
    getData,
    updateData,
    createData,
    deleteData,
};

module.exports = { toolImplementations }; 