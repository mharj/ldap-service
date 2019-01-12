const ldap = require('ldapjs');
const LdapBerkley = require('./backends/ldapbaselevel');
let db = new LdapBerkley({
	filename: 'userDn',
	directory: 'db/userDn',
});
let server = ldap.createServer();

server.search('o=test', db, db.search );

server.listen(1389, function() {
	console.log('LDAP server listening at %s', server.url);
});
