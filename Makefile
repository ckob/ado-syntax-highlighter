# --- Config ---
DIST_DIR := dist
CHROME_BUILD := $(DIST_DIR)/chrome_build
FIREFOX_BUILD := $(DIST_DIR)/firefox_build
CHROME_ZIP := $(DIST_DIR)/chrome-extension.zip
FIREFOX_ZIP := $(DIST_DIR)/firefox-extension.zip

# --- Source Files ---
COMMON_FILES := \
	background.js \
	browser-polyfill.min.js \
	content_script.js \
	custom_styles.css \
	options.html \
	options.js \
	LICENSE

COMMON_DIRS := \
	assets \
	prism

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
	@cp manifest.chrome.json $(CHROME_BUILD)/manifest.json

firefox:
	@echo "Building Firefox..."
	@rm -rf $(FIREFOX_BUILD)
	@mkdir -p $(FIREFOX_BUILD)
	@cp $(COMMON_FILES) $(FIREFOX_BUILD)/
	@cp -r $(COMMON_DIRS) $(FIREFOX_BUILD)/
	@cp manifest.firefox.json $(FIREFOX_BUILD)/manifest.json

# --- Package (Zip) Targets ---
package-chrome: chrome
	@echo "Zipping Chrome..."
	@rm -f $(CHROME_ZIP)
	@cd $(CHROME_BUILD) && zip -r ../$(notdir $(CHROME_ZIP)) .

package-firefox: firefox
	@echo "Zipping Firefox..."
	@rm -f $(FIREFOX_ZIP)
	@cd $(FIREFOX_BUILD) && zip -r ../$(notdir $(FIREFOX_ZIP)) .

.PHONY: all package clean chrome firefox package-chrome package-firefox