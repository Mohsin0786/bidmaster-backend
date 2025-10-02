const config = require('../config/config');

let sendSMSToContacts;
if (config.twilio) {
  const { sid, authToken, phone } = config.twilio;
  const client = require('twilio')(sid, authToken);
  // body: string
  sendSMSToContacts = async function (contacts, body) {
    const msgPromises = contacts.map(async user => {
      return client.messages
        .create({ body, from: phone, to: user.phone })
        .then(() => false)
        .catch(e => {
          console.log(e);
          return user;
        });
    });
    const failures = await Promise.all(msgPromises);
    return failures.filter(f => !!f);
  };
} else {
  sendSMSToContacts = async function () {
    throw new Error('Twilio configuration is missing. SMS service is disabled.');
  };
}

module.exports = {
  sendSMSToContacts,
};
