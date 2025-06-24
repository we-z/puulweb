/**
 * functions/mock-data.js
 * 
 * Generates a complete set of mock data for a new user account.
 * This helps in populating the platform for demonstration and testing purposes.
 */

const getMockData = (uid, userEmail, userDisplayName) => {
    // --- BASE ENTITIES ---
    const properties = {};
    const tenants = {};
    const owners = {};
    const vendors = {};
    const leases = {};
    const workOrders = {};
    const glAccounts = {};
    const bankAccounts = {};
    const calendarEvents = {};
    const iotDevices = {};
    const transactions = {};
    const receivables = {};
    const payables = {};
    const recurringWorkOrders = {};
    const inspections = {};
    const unitTurns = {};
    const projects = {};
    const purchaseOrders = {};
    const inventory = {};
    const fixedAssets = {};
    const scheduledReports = {};
    const surveys = {};
    const letters = {};
    const forms = {};
    const conversations = {};
    const messages = {};

    // Generate IDs
    const propertyIds = Array.from({ length: 5 }, (_, i) => `prop_${i + 1}`);
    const tenantIds = Array.from({ length: 10 }, (_, i) => `tenant_${i + 1}`);
    const ownerIds = Array.from({ length: 5 }, (_, i) => `owner_${i + 1}`);
    const vendorIds = Array.from({ length: 10 }, (_, i) => `vendor_${i + 1}`);
    const leaseIds = Array.from({ length: 10 }, (_, i) => `lease_${i + 1}`);
    const workOrderIds = Array.from({ length: 20 }, (_, i) => `wo_${i + 1}`);
    const glAccountIds = Array.from({ length: 20 }, (_, i) => `gl_${i + 1}`);
    const bankAccountIds = Array.from({ length: 5 }, (_, i) => `bank_${i + 1}`);

    // --- GENERATE DATA ---

    // 1. Properties
    const propertyTypes = ['Single Family Home', 'Multi-Family Building', 'Apartment Unit', 'Commercial Storefront', 'Condominium'];
    propertyIds.forEach((id, i) => {
        properties[id] = {
            address: `${100 + i * 12} Maple St, Springfield, IL 62704`,
            type: propertyTypes[i % propertyTypes.length],
            numberOfUnits: (i % propertyTypes.length) === 1 ? 10 : 1,
            squareFootage: 1200 + i * 200,
            yearBuilt: 1980 + i * 5,
            bedrooms: 2 + i,
            bathrooms: 1.5 + (i * 0.5),
            parkingSpots: 2,
            purchasePrice: 150000 + i * 25000,
            marketValue: 180000 + i * 30000,
            purchaseDate: `2015-0${i+1}-15`,
            notes: 'Initial property setup.',
            status: 'Occupied',
            userId: uid,
            createdAt: Date.now() - (365 * 24 * 60 * 60 * 1000 * (5-i)),
            updatedAt: Date.now(),
        };
    });

    // 2. Tenants
    const tenantNames = ['Alice Johnson', 'Bob Williams', 'Charlie Brown', 'Diana Miller', 'Ethan Davis', 'Fiona Garcia', 'George Rodriguez', 'Hannah Martinez', 'Ian Hernandez', 'Jane Lopez'];
    tenantIds.forEach((id, i) => {
        tenants[id] = {
            fullName: tenantNames[i],
            email: `tenant${i}@example.com`,
            phone: `555-010${i}`,
            propertyId: propertyIds[i % propertyIds.length],
            unitNumber: (i % propertyIds.length) === 1 ? `Apt ${i+1}` : '',
            leaseId: leaseIds[i],
            authUid: null, // Not linked by default
            userId: uid,
            createdAt: Date.now() - (180 * 24 * 60 * 60 * 1000 * (10-i)),
            updatedAt: Date.now(),
        };
    });

    // 3. Owners
    const ownerNames = ['Olivia Smith', 'Liam Jones', 'Emma Taylor', 'Noah Wilson', 'Ava Moore'];
    ownerIds.forEach((id, i) => {
        owners[id] = {
            fullName: ownerNames[i],
            email: `owner${i}@example.com`,
            phone: `555-020${i}`,
            mailingAddress: `${200 + i*5} Oak Ave, Springfield, IL 62704`,
            userId: uid,
            createdAt: Date.now(),
            updatedAt: Date.now(),
        };
    });

    // 4. Vendors
    const vendorServices = ['Plumbing', 'Electrical', 'HVAC', 'Landscaping', 'General Contractor', 'Painting', 'Cleaning', 'Roofing', 'Pest Control', 'Appliances'];
    vendorIds.forEach((id, i) => {
        vendors[id] = {
            companyName: `${vendorServices[i]} Services Inc.`,
            contactName: `Vendor Contact ${i}`,
            serviceType: vendorServices[i],
            email: `vendor${i}@example.com`,
            phone: `555-030${i}`,
            userId: uid,
            createdAt: Date.now(),
            updatedAt: Date.now(),
        };
    });
    
    // 5. Leases
    leaseIds.forEach((id, i) => {
        const startDate = new Date();
        startDate.setFullYear(startDate.getFullYear() - 1);
        startDate.setMonth(i);
        const endDate = new Date(startDate);
        endDate.setFullYear(endDate.getFullYear() + 1);

        leases[id] = {
            tenants: tenantNames[i],
            propertyId: propertyIds[i % propertyIds.length],
            unitId: `unit_for_prop_${i % propertyIds.length}`, // Placeholder
            startDate: startDate.toISOString().split('T')[0],
            endDate: endDate.toISOString().split('T')[0],
            rentAmount: 1200 + i * 50,
            status: 'Active',
            userId: uid,
            createdAt: startDate.getTime(),
            updatedAt: Date.now(),
        };
    });

    // 6. Work Orders
    const woStatuses = ['Open', 'In Progress', 'Closed'];
    const woPriorities = ['Low', 'Medium', 'High'];
    workOrderIds.forEach((id, i) => {
        const createdAt = Date.now() - (15 * i * 24 * 60 * 60 * 1000);
        workOrders[id] = {
            title: `Repair leaky faucet in Unit ${i+1}`,
            description: `Tenant reported a leaky faucet in the kitchen sink. Needs immediate attention.`,
            propertyId: propertyIds[i % propertyIds.length],
            status: woStatuses[i % woStatuses.length],
            priority: woPriorities[i % woPriorities.length],
            createdAt: createdAt,
            updatedAt: createdAt + (woStatuses[i % woStatuses.length] === 'Closed' ? (5 * 24 * 60 * 60 * 1000) : 0),
            userId: uid,
        };
    });
    
    // 7. GL Accounts (Chart of Accounts)
    const accountTypes = {
        '1000': { name: 'Assets', type: 'Asset' },
        '2000': { name: 'Liabilities', type: 'Liability' },
        '3000': { name: 'Equity', type: 'Equity' },
        '4000': { name: 'Income', type: 'Income' },
        '5000': { name: 'Expenses', type: 'Expense' },
    };
    const specificAccounts = [
        { num: '1010', name: 'Operating Bank Account', type: 'Asset' },
        { num: '1200', name: 'Accounts Receivable', type: 'Asset' },
        { num: '2010', name: 'Accounts Payable', type: 'Liability' },
        { num: '4010', name: 'Rental Income', type: 'Income' },
        { num: '5010', name: 'Maintenance Expense', type: 'Expense' },
        { num: '5020', name: 'Utilities Expense', type: 'Expense' },
        { num: '5030', name: 'Management Fees', type: 'Expense' },
    ];
    specificAccounts.forEach((acc, i) => {
        glAccounts[`gl_${i+1}`] = { ...acc, userId: uid };
    });

    // 8. Bank Accounts
    bankAccountIds.forEach((id, i) => {
        bankAccounts[id] = {
            accountName: `Operating Account ${i+1}`,
            bankName: `Springfield Bank`,
            accountNumber: `...${1000 + i}`,
            type: 'Checking',
            currentBalance: 50000 + i * 10000,
            userId: uid,
        };
    });

    // 9. Calendar Events
    for (let i = 0; i < 20; i++) {
        const date = new Date();
        date.setDate(date.getDate() + (i * 3) - 30); // Spread events around today
        const eventType = ['Inspection', 'Maintenance', 'Lease Signing', 'Move-out'][i%4];
        calendarEvents[`event_${i}`] = {
            title: `${eventType}: ${propertyTypes[i % propertyTypes.length]}`,
            startDate: date.toISOString(),
            endDate: new Date(date.getTime() + (60 * 60 * 1000)).toISOString(),
            propertyId: propertyIds[i % propertyIds.length],
            userId: uid,
        };
    }

    // 10. IoT Devices (for Smart Maintenance)
    for (let i = 0; i < 10; i++) {
        const deviceType = ['Smart Thermostat', 'Leak Detector'][i%2];
        iotDevices[`iot_${i}`] = {
            name: `${deviceType} #${i+1}`,
            type: deviceType,
            propertyId: propertyIds[i % propertyIds.length],
            status: (i%5 === 0) ? 'offline' : 'online',
            battery: (i%3 === 0) ? 15 : 98,
            userId: uid,
        };
    }
    
    // More data can be added here for other sections...
    // For now, this provides a solid base.
    
    const mockData = {
        properties: { [uid]: properties },
        tenants: { [uid]: tenants },
        owners: { [uid]: owners },
        vendors: { [uid]: vendors },
        leases: { [uid]: leases },
        workOrders: { [uid]: workOrders },
        glAccounts: { [uid]: glAccounts },
        bankAccounts: { [uid]: bankAccounts },
        calendarEvents: { [uid]: calendarEvents },
        iotDevices: { [uid]: iotDevices },
        // Add other data sections here as they are created
        // transactions: { [uid]: transactions },
        // receivables: { [uid]: receivables },
        // payables: { [uid]: payables },
    };

    return mockData;
};

module.exports = { getMockData }; 