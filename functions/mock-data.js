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
    const propertyIds = Array.from({ length: 15 }, (_, i) => `prop_${i + 1}`);
    const tenantIds = Array.from({ length: 25 }, (_, i) => `tenant_${i + 1}`);
    const ownerIds = Array.from({ length: 5 }, (_, i) => `owner_${i + 1}`);
    const vendorIds = Array.from({ length: 10 }, (_, i) => `vendor_${i + 1}`);
    const leaseIds = Array.from({ length: 25 }, (_, i) => `lease_${i + 1}`);
    const workOrderIds = Array.from({ length: 50 }, (_, i) => `wo_${i + 1}`);
    const glAccountIds = Array.from({ length: 20 }, (_, i) => `gl_${i + 1}`);
    const bankAccountIds = Array.from({ length: 5 }, (_, i) => `bank_${i + 1}`);

    // --- GENERATE DATA ---

    // 1. Properties
    const propertyTypes = ['Single Family Home', 'Multi-Family Building', 'Apartment Unit', 'Commercial Storefront', 'Condominium'];
    propertyIds.forEach((id, i) => {
        const isMultiFamily = (i % propertyTypes.length) === 1;
        properties[id] = {
            address: `${100 + i * 12} Maple St, Springfield, IL 62704`,
            type: propertyTypes[i % propertyTypes.length],
            numberOfUnits: isMultiFamily ? (10 + i) : 1,
            squareFootage: 1200 + i * 200,
            yearBuilt: 1980 + i * 5,
            bedrooms: isMultiFamily ? 0 : (2 + i % 3), // Not applicable for the building itself
            bathrooms: isMultiFamily ? 0 : (1.5 + ((i % 3) * 0.5)),
            parkingSpots: 2,
            purchasePrice: 150000 + i * 25000,
            marketValue: 180000 + i * 30000,
            purchaseDate: `2015-0${(i%12)+1}-15`,
            notes: 'Initial property setup.',
            status: i < 12 ? 'Occupied' : 'Vacant', // Have some vacancies
            userId: uid,
            createdAt: Date.now() - (365 * 24 * 60 * 60 * 1000 * (5-i)),
            updatedAt: Date.now(),
        };
    });

    // 2. Tenants
    const tenantNames = ['Alice Johnson', 'Bob Williams', 'Charlie Brown', 'Diana Miller', 'Ethan Davis', 'Fiona Garcia', 'George Rodriguez', 'Hannah Martinez', 'Ian Hernandez', 'Jane Lopez', 'Kevin Scott', 'Laura Green', 'Mike Adams', 'Nancy Baker', 'Oscar Nelson', 'Patty Carter', 'Quincy Mitchell', 'Rachel Perez', 'Steve Roberts', 'Tina Turner', 'Ursula Evans', 'Victor Phillips', 'Wendy Campbell', 'Xavier Parker', 'Yvonne Edwards'];
    tenantIds.forEach((id, i) => {
        tenants[id] = {
            fullName: tenantNames[i],
            email: `tenant${i}@example.com`,
            phone: `555-010${i}`,
            propertyId: propertyIds[i % propertyIds.length],
            unitNumber: (i % 5 === 1) ? `Apt ${100+i}` : '',
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
        startDate.setMonth(i % 12);
        const endDate = new Date(startDate);
        endDate.setFullYear(endDate.getFullYear() + 1);
        
        const status = i < 20 ? 'Active' : (i < 23 ? 'Expired' : 'Future');

        leases[id] = {
            tenants: tenantNames[i],
            propertyId: propertyIds[i % propertyIds.length],
            unitId: `unit_for_prop_${i % propertyIds.length}`, // Placeholder
            startDate: startDate.toISOString().split('T')[0],
            endDate: endDate.toISOString().split('T')[0],
            rentAmount: 1200 + i * 50,
            status: status,
            isDelinquent: (i % 7 === 0 && status === 'Active'),
            delinquentAmount: (i % 7 === 0 && status === 'Active') ? (150 + i * 10) : 0,
            userId: uid,
            createdAt: startDate.getTime(),
            updatedAt: Date.now(),
        };
    });

    // 6. Work Orders (more variety)
    const woStatuses = ['Open', 'In Progress', 'Closed', 'On Hold'];
    const woPriorities = ['Low', 'Medium', 'High'];
    const woTitles = ['Leaky Faucet', 'AC Not Cooling', 'Broken Window', 'Clogged Drain', 'Light Fixture Out'];
    workOrderIds.forEach((id, i) => {
        const createdAt = Date.now() - (7 * i * 24 * 60 * 60 * 1000); // Spread out over ~ a year
        const status = woStatuses[i % woStatuses.length];
        const closed = status === 'Closed';
        workOrders[id] = {
            title: `${woTitles[i % woTitles.length]} in Unit ${i+1}`,
            description: `Tenant reported an issue. Needs assessment.`,
            propertyId: propertyIds[i % propertyIds.length],
            status: status,
            priority: woPriorities[i % woPriorities.length],
            createdAt: createdAt,
            updatedAt: closed ? createdAt + (5 * 24 * 60 * 60 * 1000) : createdAt,
            completedDate: closed ? new Date(createdAt + (5 * 24 * 60 * 60 * 1000)).toISOString().split('T')[0] : null,
            cost: closed ? (50 + i * 5) : 0,
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
    
    // 11. Transactions (for charts)
    for (let i = 0; i < 12; i++) { // Last 12 months, i=0 is current month, i=11 is 11 months ago
        const date = new Date();
        date.setMonth(date.getMonth() - i);

        let monthlyRevenue = 0;
        // Income: higher in more recent months, with slight fluctuations
        for (let j = 0; j < 15; j++) { // 15 rental payments per month
            let rentAmount = (1200 + ((11 - i) * 50)) + (j * 20); // Base rent increases as i gets smaller
            rentAmount *= (1 + (Math.random() - 0.5) * 0.1); // Add +/- 5% random fluctuation
            monthlyRevenue += rentAmount;
            transactions[`inc_${i}_${j}`] = {
                date: new Date(date.getFullYear(), date.getMonth(), 1).toISOString().split('T')[0],
                type: 'Income',
                category: 'Rental Income',
                description: `Rent for Property ${j + 1}`,
                amount: parseFloat(rentAmount.toFixed(2)),
                userId: uid,
            };
        }

        // Expenses: a percentage of revenue, ensuring they are always lower and slightly increasing over time.
        const expenseRatio = 0.35 + ((11 - i) * 0.01); // Expenses are ~35% of revenue in oldest month, up to ~46% in newest
        const monthlyExpenses = monthlyRevenue * expenseRatio;
        const expenseCategories = ['Maintenance', 'Utilities', 'Management Fees', 'Taxes', 'Insurance'];
        for (let j = 0; j < 5; j++) {
            const expenseAmount = (monthlyExpenses / 5) * (1 + (Math.random() - 0.5) * 0.2); // Add some randomness
            transactions[`exp_${i}_${j}`] = {
                date: new Date(date.getFullYear(), date.getMonth(), 15).toISOString().split('T')[0],
                type: 'Expense',
                category: expenseCategories[j],
                description: `${expenseCategories[j]} payment`,
                amount: parseFloat(expenseAmount.toFixed(2)),
                userId: uid,
            };
        }
    }
    
    // 12. Receivables (for payment status chart)
    const receivableStatuses = ['Paid', 'Overdue', 'Pending', 'Paid'];
    for(let i=0; i < 40; i++) {
        receivables[`rec_${i}`] = {
            date: new Date(Date.now() - (i * 15 * 24 * 60 * 60 * 1000)).toISOString().split('T')[0],
            payerName: tenantNames[i % tenantNames.length],
            propertyId: propertyIds[i % propertyIds.length],
            description: 'Monthly Rent',
            amountDue: 1200 + i*20,
            amountPaid: receivableStatuses[i % receivableStatuses.length] === 'Paid' ? (1200 + i*20) : 0,
            status: receivableStatuses[i % receivableStatuses.length],
            userId: uid,
        };
    }
    
    // --- FINAL DATA OBJECT ---
    const mockData = {
        properties: properties,
        tenants: tenants,
        owners: owners,
        vendors: vendors,
        leases: leases,
        workOrders: workOrders,
        glAccounts: glAccounts,
        bankAccounts: bankAccounts,
        calendarEvents: calendarEvents,
        iotDevices: iotDevices,
        transactions: transactions,
        receivables: receivables,
        payables: payables,
        recurringWorkOrders: recurringWorkOrders,
        inspections: inspections,
        unitTurns: unitTurns,
        projects: projects,
        purchaseOrders: purchaseOrders,
        inventory: inventory,
        fixedAssets: fixedAssets,
        scheduledReports: scheduledReports,
        surveys: surveys,
        letters: letters,
        forms: forms,
        conversations: conversations,
        messages: messages,
    };

    const finalDataForUser = {};
    for (const key in mockData) {
        finalDataForUser[key] = { [uid]: mockData[key] };
    }

    return finalDataForUser;
};

// Re-structure what is returned from getMockData to match new logic in index.js
const getMockDataForUser = (uid, userEmail, userDisplayName) => {
    // Helper to generate IDs
    const generateIds = (prefix, count) => Array.from({ length: count }, (_, i) => `${prefix}_${i + 1}`);

    // Tenant names for mock data
    const tenantNames = [
        'Alice Johnson', 'Bob Williams', 'Charlie Brown', 'Diana Miller', 'Ethan Davis',
        'Fiona Garcia', 'George Rodriguez', 'Hannah Martinez', 'Ian Hernandez', 'Jane Lopez',
        'Kevin Scott', 'Laura Green', 'Mike Adams', 'Nancy Baker', 'Oscar Nelson',
        'Patty Carter', 'Quincy Mitchell', 'Rachel Perez', 'Steve Roberts', 'Tina Turner',
        'Ursula Evans', 'Victor Phillips', 'Wendy Campbell', 'Xavier Parker', 'Yvonne Edwards'
    ];

    // Generate IDs for all entities
    const propertyIds = generateIds('prop', 15);
    // Dynamically size lease/tenant arrays to cover all possible units (plus buffer for expired/future leases)
    let tempTotalUnits = 0;
    propertyIds.forEach((id, i) => {
        const isMultiFamily = (i % 5) === 1;
        tempTotalUnits += isMultiFamily ? (10 + i) : 1;
    });
    const maxLeases = Math.ceil(tempTotalUnits * 1.2); // 20% buffer
    const tenantIds = generateIds('tenant', maxLeases);
    const leaseIds = generateIds('lease', maxLeases);
    const ownerIds = generateIds('owner', 5);
    const vendorIds = generateIds('vendor', 10);
    const workOrderIds = generateIds('wo', 50);
    const glAccountIds = generateIds('gl', 20);
    const bankAccountIds = generateIds('bank', 5);
    const eventIds = generateIds('event', 30);
    const iotDeviceIds = generateIds('iot', 15);
    const receivableIds = generateIds('rec', 40);
    const payableIds = generateIds('pay', 30);
    const recurringWoIds = generateIds('rwo', 10);
    const inspectionIds = generateIds('insp', 15);
    const unitTurnIds = generateIds('ut', 5);
    const projectIds = generateIds('proj', 5);
    const poIds = generateIds('po', 10);
    const inventoryIds = generateIds('inv', 20);
    const assetIds = generateIds('asset', 10);
    const reportIds = generateIds('report', 5);
    const surveyIds = generateIds('survey', 5);
    const letterIds = generateIds('letter', 5);
    const formIds = generateIds('form', 5);

    // --- Data Objects ---
    const data = {
        properties: {}, tenants: {}, owners: {}, vendors: {}, leases: {}, workOrders: {},
        glAccounts: {}, bankAccounts: {}, calendarEvents: {}, iotDevices: {}, transactions: {},
        receivables: {}, payables: {}, recurringWorkOrders: {}, inspections: {}, unitTurns: {},
        projects: {}, purchaseOrders: {}, inventory: {}, fixedAssets: {}, scheduledReports: {},
        surveys: {}, letters: {}, forms: {}
    };

    // --- Data Generation Logic ---

    // Properties
    const propertyTypes = ['Single Family Home', 'Multi-Family Building', 'Apartment Unit', 'Commercial Storefront', 'Condominium'];
    let totalUnits = 0;
    propertyIds.forEach((id, i) => {
        const isMultiFamily = (i % propertyTypes.length) === 1;
        const units = isMultiFamily ? (10 + i) : 1;
        totalUnits += units;
        data.properties[id] = {
            address: `${100 + i * 12} Maple St, Springfield, IL 62704`,
            type: propertyTypes[i % propertyTypes.length],
            numberOfUnits: units,
            squareFootage: 1200 + i * 200,
            yearBuilt: 1980 + i * 5,
            bedrooms: isMultiFamily ? 0 : (2 + i % 3),
            bathrooms: isMultiFamily ? 0 : (1.5 + ((i % 3) * 0.5)),
            purchasePrice: 150000 + i * 25000,
            marketValue: 180000 + i * 30000,
            purchaseDate: `2015-0${(i%12)+1}-15`,
            status: 'Occupied', // We'll set actual occupancy via leases
            userId: uid,
            createdAt: Date.now() - (365 * 24 * 60 * 60 * 1000 * (5-i)),
            updatedAt: Date.now()
        };
    });

    // --- OCCUPANCY TREND LOGIC ---
    // We want occupancy to go up and to the right, ending at 90% of total units.
    const months = [];
    const now = new Date();
    for (let i = 11; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        months.push({
            key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
            start: new Date(d.getFullYear(), d.getMonth(), 1),
            end: new Date(d.getFullYear(), d.getMonth() + 1, 0)
        });
    }
    // Target occupancy rates: start at 70%, end at 90%, with random upward variation
    const minOcc = 0.70, maxOcc = 0.90;
    let lastRate = minOcc;
    const occRates = months.map((_, i) => {
        // Add a little random upward bump, but always increase
        if (i === 0) return lastRate;
        let bump = 0.01 + Math.random() * 0.03; // 1-4% bump
        let next = Math.min(maxOcc, lastRate + bump);
        // Ensure last month is exactly maxOcc
        if (i === months.length - 1) next = maxOcc;
        lastRate = next;
        return next;
    });
    const occTargets = occRates.map(r => Math.round(r * totalUnits));

    // --- LEASES ---
    // We'll create enough leases so that for each month, the number of active leases matches occTargets.
    // We'll stagger lease start/end dates so that each month, more leases become active.
    const leaseLengthMonths = 12; // All leases are 12 months for simplicity
    let leaseIdx = 0;
    let tenantIdx = 0;
    let leaseStartBase = new Date(now.getFullYear(), now.getMonth() - leaseLengthMonths + 1, 1);
    for (let m = 0; m < months.length; m++) {
        const needed = occTargets[m] - (m === 0 ? 0 : occTargets[m-1]);
        for (let j = 0; j < needed; j++) {
            if (leaseIdx >= leaseIds.length || tenantIdx >= tenantIds.length) break;
            const leaseId = leaseIds[leaseIdx];
            const tenantId = tenantIds[tenantIdx];
            // Lease starts at the beginning of this month, ends 12 months later
            const startDate = new Date(months[m].start);
            const endDate = new Date(startDate);
            endDate.setMonth(endDate.getMonth() + leaseLengthMonths);
            const status = (endDate >= now && startDate <= now) ? 'Active' : (endDate < now ? 'Expired' : 'Future');
            const leaseData = {
                tenants: tenantNames[tenantIdx % tenantNames.length],
                propertyId: propertyIds[(leaseIdx) % propertyIds.length],
                startDate: startDate.toISOString().split('T')[0],
                endDate: endDate.toISOString().split('T')[0],
                rentAmount: 1200 + leaseIdx * 50,
                status,
                isDelinquent: false,
                delinquentAmount: 0,
                userId: uid,
                createdAt: startDate.getTime(),
                updatedAt: Date.now()
            };
            data.leases[leaseId] = leaseData;
            data.tenants[tenantId] = {
                fullName: tenantNames[tenantIdx % tenantNames.length],
                email: `tenant${tenantIdx}@example.com`,
                phone: `555-010${tenantIdx}`,
                propertyId: leaseData.propertyId,
                leaseId: leaseId,
                userId: uid
            };
            leaseIdx++;
            tenantIdx++;
        }
    }
    // Fill remaining leases as expired/future for realism
    for (; leaseIdx < leaseIds.length && tenantIdx < tenantIds.length; leaseIdx++, tenantIdx++) {
        const leaseId = leaseIds[leaseIdx];
        const tenantId = tenantIds[tenantIdx];
        const startDate = new Date(now.getFullYear(), now.getMonth() - 24 + leaseIdx, 1);
        const endDate = new Date(startDate);
        endDate.setMonth(endDate.getMonth() + leaseLengthMonths);
        const status = (endDate >= now && startDate <= now) ? 'Active' : (endDate < now ? 'Expired' : 'Future');
        const leaseData = {
            tenants: tenantNames[tenantIdx % tenantNames.length],
            propertyId: propertyIds[(leaseIdx) % propertyIds.length],
            startDate: startDate.toISOString().split('T')[0],
            endDate: endDate.toISOString().split('T')[0],
            rentAmount: 1200 + leaseIdx * 50,
            status,
            isDelinquent: false,
            delinquentAmount: 0,
            userId: uid,
            createdAt: startDate.getTime(),
            updatedAt: Date.now()
        };
        data.leases[leaseId] = leaseData;
        data.tenants[tenantId] = {
            fullName: tenantNames[tenantIdx % tenantNames.length],
            email: `tenant${tenantIdx}@example.com`,
            phone: `555-010${tenantIdx}`,
            propertyId: leaseData.propertyId,
            leaseId: leaseId,
            userId: uid
        };
    }
    
    // Work Orders
    const woStatuses = ['Open', 'In Progress', 'Closed', 'On Hold'];
    const woPriorities = ['Low', 'Medium', 'High'];
    workOrderIds.forEach((id, i) => {
        const createdAt = Date.now() - (7 * i * 24 * 60 * 60 * 1000);
        const status = woStatuses[i % woStatuses.length];
        const closed = status === 'Closed';
        data.workOrders[id] = { title: `Repair in Unit ${i+1}`, description: `Tenant reported an issue.`, propertyId: propertyIds[i % propertyIds.length], status, priority: woPriorities[i % woPriorities.length], createdAt, updatedAt: closed ? createdAt + (5 * 24 * 60 * 60 * 1000) : createdAt, completedDate: closed ? new Date(createdAt + (5 * 24 * 60 * 60 * 1000)).toISOString().split('T')[0] : null, cost: closed ? (50 + i * 5) : 0, userId: uid };
    });

    // --- TRANSACTIONS (for charts) ---
    // For each of the last 12 months, sum the rentAmount of all leases active in that month, and use that as the total income for that month.
    const monthlyMRR = [];
    for (let i = 0; i < 12; i++) {
        const month = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const monthStart = new Date(month.getFullYear(), month.getMonth(), 1);
        const monthEnd = new Date(month.getFullYear(), month.getMonth() + 1, 0);
        // Find all leases active in this month
        let mrr = 0;
        Object.values(data.leases).forEach(l => {
            const leaseStart = new Date(l.startDate);
            const leaseEnd = new Date(l.endDate);
            if (l.status === 'Active' && leaseStart <= monthEnd && leaseEnd >= monthStart) {
                mrr += parseFloat(l.rentAmount) || 0;
            }
        });
        monthlyMRR.push(mrr);
    }
    // Now generate transactions so that the sum of Income for each month matches monthlyMRR
    for (let i = 0; i < 12; i++) { // Last 12 months, i=0 is current month, i=11 is 11 months ago
        const date = new Date();
        date.setMonth(date.getMonth() - i);
        const incomeTotal = monthlyMRR[i];
        const numPayments = 15; // Number of income transactions per month
        let distributed = 0;
        for (let j = 0; j < numPayments; j++) {
            // Distribute the income, last payment gets the remainder for perfect sum
            let rentAmount;
            if (j === numPayments - 1) {
                rentAmount = incomeTotal - distributed;
            } else {
                rentAmount = Math.round((incomeTotal / numPayments + (Math.random() - 0.5) * 0.05 * incomeTotal) * 100) / 100;
                distributed += rentAmount;
            }
            data.transactions[`inc_${i}_${j}`] = {
                date: new Date(date.getFullYear(), date.getMonth(), 1).toISOString().split('T')[0],
                type: 'Income',
                category: 'Rental Income',
                description: `Rent for Property ${j + 1}`,
                amount: parseFloat(rentAmount.toFixed(2)),
                userId: uid,
            };
        }
        // Expenses: a percentage of revenue, ensuring they are always lower and slightly increasing over time.
        const expenseRatio = 0.35 + ((11 - i) * 0.01); // Expenses are ~35% of revenue in oldest month, up to ~46% in newest
        const monthlyExpenses = incomeTotal * expenseRatio;
        const expenseCategories = ['Maintenance', 'Utilities', 'Management Fees', 'Taxes', 'Insurance'];
        for (let j = 0; j < 5; j++) {
            const expenseAmount = (monthlyExpenses / 5) * (1 + (Math.random() - 0.5) * 0.2); // Add some randomness
            data.transactions[`exp_${i}_${j}`] = {
                date: new Date(date.getFullYear(), date.getMonth(), 15).toISOString().split('T')[0],
                type: 'Expense',
                category: expenseCategories[j],
                description: `${expenseCategories[j]} payment`,
                amount: parseFloat(expenseAmount.toFixed(2)),
                userId: uid,
            };
        }
    }
    
    // Receivables
    const receivableStatuses = ['Paid', 'Overdue', 'Pending', 'Paid'];
    receivableIds.forEach((id, i) => {
        data.receivables[id] = { date: new Date(Date.now() - (i * 15 * 24 * 60 * 60 * 1000)).toISOString().split('T')[0], payerName: tenantNames[i % tenantNames.length], propertyId: propertyIds[i % propertyIds.length], description: 'Monthly Rent', amountDue: 1200 + i*20, amountPaid: receivableStatuses[i % receivableStatuses.length] === 'Paid' ? (1200 + i*20) : 0, status: receivableStatuses[i % receivableStatuses.length], userId: uid };
    });
    
    const finalDataForDB = {};
    for (const key in data) {
        if(Object.keys(data[key]).length > 0) { // Only add if there's data
             finalDataForDB[key] = data[key];
        }
    }
    return finalDataForDB;
}

module.exports = { getMockData: getMockDataForUser }; 