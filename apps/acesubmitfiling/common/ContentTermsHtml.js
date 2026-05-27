sap.ui.define([], function () {
	"use strict";

	return {
		getContentTermsHtml: function (sContent) {
			//----- in progress ----
			var sContent = sContent.outerHTML || sContent.innerHTML || sContent;
			sContent = sContent.replace('src="/resource/', 'src="https://login.cbp.gov/resource/');
			return `
               <!DOCTYPE html>
				<html>
				<head>
				    <link class="user" href="https://login.cbp.gov/resource/1720800604000/LGN_VisualforceAssets/css/2fa.css" rel="stylesheet"
				        type="text/css" />
				    <link class="user" href="https://login.cbp.gov/resource/1720800604000/LGN_SLDS/styles/salesforce-lightning-design-system.min.css"
				        rel="stylesheet" type="text/css" />
				</head>
				<body>
					${sContent}
				</body>
				</html>
            `;
		}
	};
});