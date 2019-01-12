



# referrals
res.send(res.createSearchReference(['ldap://localhost:389/dc=some,dc=lan']));
res.end();

# rootDSE
```javascript
server.search('', function(req, res, next) {
	// rootDSE response
	let rootDSEobj = {
		dn: req.dn.toString(),
		attributes: {
			objectClass: ['top', 'LDAPJSrootDSE'],
			structuralObjectClass: 'LDAPJSrootDSE',
			namingContexts: 'o=example.org',
			supportedLDAPVersion: '3',
		},
	};

	// rootDSE minimal response with only objectClass
	let rootDSEobjMin = {
		dn: req.dn.toString(),
		attributes: {
			objectClass: ['top', 'LDAPJSrootDSE'],
		},
	};

	// rootDSE search require base scope
	if (req.scope !== 'base') {
		return next(new ldap.NoSuchObjectError());
	}

	// For empty filter emulate operational attributes (minimal response)
	if (req.attributes.toString() === '') {
		res.send(rootDSEobjMin);
	} else if (req.attributes.toString() === '+') {
		// Want to send all attributes
		res.send(rootDSEobj);
	} else if (req.filter.matches(rootDSEobj.attributes)) {
		res.send(rootDSEobj);
	}
	res.end();
});
```

# debug
```javascript
server.use(function(req, res, next) {
	console.log('REQ', req.dn.toString());
	return next();
});
```
