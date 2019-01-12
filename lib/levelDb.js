const parseDN = require('ldapjs').parseDN;
const uuid = require('uuid/v1');
const fs = require('fs');
const moment = require('moment');
const levelup = require('levelup');
const leveldown = require('leveldown');
const encode = require('encoding-down');
const path = require('path');

function serial(tasks, fn) {
	return tasks.reduce((promise, task) => promise.then((previous) => fn(task, previous)), Promise.resolve(null));
}

class LdapLevelDb {
	constructor(options) {
		let {directory, reindex} = options;
		const baseDir = path.normalize(directory);
		const initDir = '';
		// create directory structure
		baseDir.split(path.sep).reduce((parentDir, childDir) => {
			const curDir = path.resolve('.', parentDir, childDir);
			if (!fs.existsSync(curDir)) {
				fs.mkdirSync(curDir);
			}
			return curDir;
		}, initDir);
		this.entryData = levelup(encode(leveldown(path.join(baseDir, 'data')), {valueEncoding: 'json'}));
		this.dnData = levelup(leveldown(path.join(baseDir, '/entryDn')));
		this.dnSubData = levelup(encode(leveldown(path.join(baseDir, 'entrySubDn')), {valueEncoding: 'json'}));
		this.dnOneData = levelup(encode(leveldown(path.join(baseDir, 'entryOneDn')), {valueEncoding: 'json'}));
		if (reindex === null || reindex === true) {
			this.reindexAll();
		}
	}
	reindexAll() {
		let self = this;
		console.log('start reindex');
		let promises = [];
		this.entryData
			.createReadStream()
			.on('data', function(data) {
				const {key, value} = data;
				promises.push(self.reindex(value.dn, key));
			})
			.on('error', function(err) {
				console.log('Oh my!', err);
			})
			.on('end', function() {
				Promise.all(promises).then(() => {
					console.log('end reindex');
				});
			});
	}
	parseSubDns(sdn) {
		let dn = '' + sdn;
		let values = [];
		while (dn != null) {
			let parent = parseDN(dn).parent();
			if (dn) {
				values.push(dn);
			}
			dn = parent ? parent.toString() : null;
		}
		return values;
	}
	parseOneDns(sdn) {
		let dn = '' + sdn;
		let values = [];
		let count = 0;
		while (count < 2 && dn != null) {
			let parent = parseDN(dn).parent();
			if (dn) {
				values.push(dn);
			}
			count++;
			dn = parent ? parent.toString() : null;
		}
		return values;
	}
	reindexEntryOneDn(sdn, uuid) {
		let uuidValue = '' + uuid;
		let values = this.parseOneDns(sdn);
		return serial(values, (dnCopy) => {
			return this.dnOneData
				.get(dnCopy)
				.then((obj) => {
					if (obj.indexOf(uuidValue) === -1) {
						obj.push(uuidValue);
						console.log('oneindex ' + dnCopy + ' add ' + uuidValue);
						return this.dnOneData.put(dnCopy, obj);
					} else {
						console.log('oneindex ' + dnCopy + ' ok');
						return Promise.resolve();
					}
				})
				.catch((err) => {
					console.log('oneindex ' + dnCopy + ' create ' + uuidValue);
					return this.dnOneData.put(dnCopy, [uuidValue]);
				});
		});
	}
	reindexEntrySubDn(sdn, uuid) {
		let uuidValue = '' + uuid;
		let values = this.parseSubDns(sdn);
		return serial(values, (dnCopy) => {
			return this.dnSubData
				.get(dnCopy)
				.then((obj) => {
					if (obj.indexOf(uuidValue) === -1) {
						obj.push(uuidValue);
						console.log('subindex ' + dnCopy + ' add ' + uuidValue);
						return this.dnSubData.put(dnCopy, obj);
					} else {
						console.log('subindex ' + dnCopy + ' ok');
						return Promise.resolve();
					}
				})
				.catch((err) => {
					console.log('subindex ' + dnCopy + ' create ' + uuidValue);
					return this.dnSubData.put(dnCopy, [uuidValue]);
				});
		});
	}
	reindex(sdn, uuid) {
		return Promise.all([this.reindexEntrySubDn(sdn, uuid), this.reindexEntryOneDn(sdn, uuid)]);
	}
	add(dn, attributes, options) {
		let reindex = true;
		if (options && options.reindex !== null) {
			reindex = options.reindex;
		}
		let obj = {
			dn: dn.toString(),
			attributes: Object.assign({}, attributes, {
				createTimestamp: moment().toISOString(),
				creatorsName: 'cn=Directory Manager',
				modifyTimestamp: moment().toISOString(),
				modifiersName: 'cn=Directory Manager',
			}),
		};
		return this.dnData
			.get(dn)
			.then((uuidValue) => {
				console.log('modify ' + uuidValue);
				let reindexPromise = Promise.resolve();
				if (reindex) {
					reindexPromise = this.reindex(obj.dn, uuidValue);
				}
				return Promise.all([reindexPromise, this.entryData.put(uuidValue, obj)]);
			})
			.catch((err) => {
				if (err.type && err.type == 'NotFoundError') {
					let uuidValue = uuid();
					console.log('add ' + uuidValue);
					let reindexPromise = Promise.resolve();
					if (reindex) {
						reindexPromise = this.reindex(obj.dn, uuidValue);
					}
					return Promise.all([reindexPromise, this.dnData.put(dn, uuidValue), this.entryData.put(uuidValue, obj)]);
				} else {
					throw err;
				}
			});
	}
	getWithBaseDn(dn) {
		return this.dnData.get(dn).then((uuidValue) => {
			let uuidValues = [uuidValue];
			return Promise.all(uuidValues.map((uuidValue) => this.entryData.get(uuidValue)));
		});
	}
	getWithSubDn(dn) {
		return this.dnSubData.get(dn).then((uuidValues) => {
			return Promise.all(uuidValues.map((uuidValue) => this.entryData.get(uuidValue)));
		});
	}
	getWithOneDn(dn) {
		return this.dnOneData.get(dn).then((uuidValues) => {
			return Promise.all(uuidValues.map((uuidValue) => this.entryData.get(uuidValue)));
		});
	}
	getWithDn(dn, scope) {
		switch (scope) {
			case 'base':
				return this.getWithBaseDn(dn);
			case 'sub':
				return this.getWithSubDn(dn);
			case 'one':
				return this.getWithOneDn(dn);
		}
	}
}
module.exports = LdapLevelDb;
