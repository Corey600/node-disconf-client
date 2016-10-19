module.exports = {
    "parserOptions": {
        "ecmaVersion": 5,
        "sourceType": "module"
    },

    "env": {
        "browser": false,
        "commonjs": true
    },

    "rules": {
        "indent": ["error", 4, { "SwitchCase": 1 }],
        "linebreak-style": ["error", "unix"],
        "quotes": ["error", "single"],
        "semi": ["error", "always"],
        "object-curly-spacing": ["warn", "never", {"objectsInObjects": false}],
        "no-debugger": "error",
        "no-alert": "error",
        "no-console": "warn"
    }
};
