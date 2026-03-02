# MyHire Chrome Plugin

## Install
1. Download and unzip `chrome-plugin-extension.zip` from the MyHire login page.
2. Open `chrome://extensions`.
3. Enable **Developer mode**.
4. Click **Load unpacked** and select the unzipped `chrome-plugin` folder.

## Usage
1. Open any job listing page.
2. Click the floating **M** icon.
3. Set your MyHire URL (for example `http://localhost:3000` or your deployed app URL).
4. Optionally attach a CV file.
5. Click **Add Job**.

The plugin sends current page URL + scraped page text to `POST /api/import`, which creates a new job in MyHire.
