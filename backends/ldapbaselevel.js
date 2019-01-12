const parseDN = require('ldapjs').parseDN;
const levelup = require('levelup');
const leveldown = require('leveldown');
const LdapLevelDb = require('../lib/levelDb');

class LdapBaseLevel {
	constructor(options) {
		const rootEntry = {
			objectclass: ['organization', 'top'],
			o: 'test',
		};
		console.log('init start');
		options.reindex = false;
		this.lldb = new LdapLevelDb(options);
		let promises = [];
		promises.push(this.lldb.add(parseDN('o=test'), rootEntry, {reindex: false}));
		promises.push(
			this.lldb.add(
				parseDN('ou=People,o=test'),
				{
					objectclass: ['organization', 'top'],
					ou: 'People',
				},
				{reindex: false},
			),
		);
		promises.push(
			this.lldb.add(
				parseDN('uid=mharj,ou=People,o=test'),
				{
					objectclass: ['organization', 'top'],
					uid: ['mharj', 'test'],
				},
				{reindex: false},
			),
		);
		Promise.all(promises).then(() => {
			console.log('init done');
			this.lldb.reindexAll();
		});
	}
	search(req, res, next) {
		console.log('scope: ' + req.scope + ' ' + req.dn);
		this.lldb
			.getWithDn(req.dn, req.scope)
			.then((objs) => {
				objs.forEach((obj) => {
					if (req.filter.matches(obj.attributes)) {
						res.send(obj);
					}
				});
				res.end();
			})
			.catch((err) => {
				console.log(err);
				res.end();
			});
	}
}
module.exports = LdapBaseLevel;
