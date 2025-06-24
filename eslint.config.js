import pluginVue from 'eslint-plugin-vue'
import globals from 'globals'

export default [
  // add more generic rulesets here, such as:
  // js.configs.recommended,
  ...pluginVue.configs['flat/recommended'],
  // ...pluginVue.configs['flat/vue2-recommended'], // Use this if you are using Vue.js 2.x.
  {
    rules: {
      "vue/v-on-event-hyphenation": "off",
      "vue/max-attributes-per-line": "off",
      "vue/singleline-html-element-content-newline": "off",
      "vue/mustache-interpolation-spacing": "off",
      "vue/html-closing-bracket-spacing": "off",
      "vue/attributes-order": "off",
      "vue/html-self-closing": "off",
      "vue/first-attribute-linebreak": "off",
      "vue/attribute-hyphenation": "off",
      "vue/html-indent": "off",
      "vue/html-closing-bracket-newline": "off",
      "vue/multi-word-component-names": "off",
      "vue/multiline-html-element-content-newline": "off",
      "vue/no-unused-components": "error",
      "vue/no-unused-vars": "error",
      "vue/one-component-per-file": "error",
      "vue/require-prop-types": "error",
      "vue/no-constant-condition": "error",
      "vue/no-template-shadow": "error",
      "vue/no-multi-spaces": "error",
      "vue/no-lone-template": "error",
      "vue/this-in-template": "error",
      "vue/no-empty-pattern": "error",
      "vue/no-useless-concat": "error",
      "vue/match-component-file-name": [
          "error",
          {
              "extensions": [
                  "vue"
              ],
              "shouldMatchCase": false
          }
      ],
      "vue/no-potential-component-option-typo": [
          "error",
          {
              "presets": [
                  "all"
              ],
              "custom": [
                  "test"
              ]
          }
      ],
      "vue/no-reserved-component-names": [
          "error",
          {
              "disallowVueBuiltInComponents": false,
              "disallowVue3BuiltInComponents": false
          }
      ],
      "vue/no-unsupported-features": [
          "error",
          {
              "version": "^3.5.13",
              "ignores": []
          }
      ],
      "vue/no-useless-template-attributes": "error",
      "vue/no-unused-refs": "error",
      "vue/no-useless-mustaches": "error",
      "vue/no-useless-v-bind": "error",
      "vue/require-name-property": "error",
      "vue/no-dupe-keys": "error",
      "vue/no-undef-properties": "error",
      "vue/no-unused-properties": [
          "error",
          {
              "groups": [
                  "props",
                  "data",
                  "computed",
                  "methods"
              ],
              "deepData": true,
              "ignorePublicMembers": false
          }
      ]
    },
    languageOptions: {
      globals: {
        ...globals.browser
      }
    }
  }
]