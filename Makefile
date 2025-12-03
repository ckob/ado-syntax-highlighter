# --- Config ---
DIST_DIR := dist
CHROME_BUILD := $(DIST_DIR)/chrome_build
FIREFOX_BUILD := $(DIST_DIR)/firefox_build
CHROME_ZIP := $(DIST_DIR)/chrome-extension.zip
FIREFOX_ZIP := $(DIST_DIR)/firefox-extension.zip

# --- Source Files ---
COMMON_FILES := \
	background.js \
	content_script.js \
	custom_styles.css \
	options.html \
	options.js \
	options.css \
	LICENSE

COMMON_DIRS := \
	assets

# --- Primary Targets ---
all: chrome firefox
package: package-chrome package-firefox

clean:
	@echo "Cleaning..."
	@rm -rf $(DIST_DIR)

# --- Build Targets ---
chrome:
	@echo "Building Chrome..."
	@rm -rf $(CHROME_BUILD)
	@mkdir -p $(CHROME_BUILD)
	@cp $(COMMON_FILES) $(CHROME_BUILD)/
	@cp -r $(COMMON_DIRS) $(CHROME_BUILD)/
	@mkdir -p $(CHROME_BUILD)/prism
	@cp prism/prism.js $(CHROME_BUILD)/prism/
	@cat prism/themes/*.css > $(CHROME_BUILD)/prism/prism.css
	@cp manifest.chrome.json $(CHROME_BUILD)/manifest.json
	@echo "Minifying assets for Chrome..."
	@npx terser browser-polyfill.js -o $(CHROME_BUILD)/browser-polyfill.min.js --comments false
	@npx terser prism/prism.js -o $(CHROME_BUILD)/prism/prism.min.js --comments false
	@rm $(CHROME_BUILD)/prism/prism.js

firefox:
	@echo "Building Firefox..."
	@rm -rf $(FIREFOX_BUILD)
	@mkdir -p $(FIREFOX_BUILD)
	@cp $(COMMON_FILES) $(FIREFOX_BUILD)/
	@cp -r $(COMMON_DIRS) $(FIREFOX_BUILD)/
	@mkdir -p $(FIREFOX_BUILD)/prism
	@cp prism/prism.js $(FIREFOX_BUILD)/prism/
	@cat prism/themes/*.css > $(FIREFOX_BUILD)/prism/prism.css
	@cp manifest.firefox.json $(FIREFOX_BUILD)/manifest.json
	@echo "Minifying assets for Firefox..."
	@npx terser browser-polyfill.js -o $(FIREFOX_BUILD)/browser-polyfill.min.js --comments false
	@npx terser prism/prism.js -o $(FIREFOX_BUILD)/prism/prism.min.js --comments false
	@rm $(FIREFOX_BUILD)/prism/prism.js

# --- Package (Zip) Targets ---
package-chrome: chrome
	@echo "Zipping Chrome..."
	@rm -f $(CHROME_ZIP)
	@cd $(CHROME_BUILD) && zip -r ../$(notdir $(CHROME_ZIP)) . -x "*.DS_Store"

package-firefox: firefox
	@echo "Zipping Firefox..."
	@rm -f $(FIREFOX_ZIP)
	@cd $(FIREFOX_BUILD) && zip -r ../$(notdir $(FIREFOX_ZIP)) . -x "*.DS_Store"

.PHONY: all package clean chrome firefox package-chrome package-firefox