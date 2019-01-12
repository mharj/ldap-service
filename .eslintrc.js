module.exports = {
	"extends": "google",
	env: {
		es6: true,
		node: true,
		mocha: true,
	},
	parserOptions: {
		ecmaVersion: 8,
		ecmaFeatures: {
			experimentalObjectRestSpread: true,
		},
		sourceType: 'module',
	},
	rules: {
		'require-jsdoc': 0,
		indent: ['error', 'tab', {SwitchCase: 1}],
		'no-tabs': 0,
		'max-len': [
			2,
			{
				code: 240,
				tabWidth: 2,
				ignoreUrls: true,
				ignoreComments: true,
			},
		],
		'key-spacing': ['error', {mode: 'minimum'}],
	},
};
