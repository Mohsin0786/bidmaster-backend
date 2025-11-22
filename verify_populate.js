const mongoose = require('mongoose');
const config = require('./src/config/config');
const { requirementService } = require('./src/services');

async function verifyPopulation() {
    try {
        await mongoose.connect(config.mongoose.url, config.mongoose.options);
        console.log('Connected to DB');

        // Simulate the controller call
        const filter = {};
        const options = {
            limit: 1,
            populate: 'createdBy::firstName,lastName,email',
        };

        const result = await requirementService.queryRequirements(filter, options);

        if (result.results.length > 0) {
            const req = result.results[0];
            console.log('Requirement ID:', req._id);
            console.log('CreatedBy:', JSON.stringify(req.createdBy, null, 2));

            if (req.createdBy && req.createdBy.email) {
                console.log('SUCCESS: createdBy is populated');
            } else {
                console.log('FAILURE: createdBy is NOT populated');
            }
        } else {
            console.log('No requirements found to test');
        }

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await mongoose.disconnect();
    }
}

verifyPopulation();
