/*global QUnit*/

jQuery.sap.require("sap.ui.qunit.qunit-css");
jQuery.sap.require("sap.ui.thirdparty.qunit");
jQuery.sap.require("sap.ui.qunit.qunit-junit");
QUnit.config.autostart = false;

sap.ui.require([
	"sap/ui/test/Opa5",
	"com/erpis/shiperp/parcel/test/integration/pages/Common",
	"sap/ui/test/opaQunit",
	"com/erpis/shiperp/parcel/test/integration/pages/Worklist",
	"com/erpis/shiperp/parcel/test/integration/pages/Object",
	"com/erpis/shiperp/parcel/test/integration/pages/NotFound",
	"com/erpis/shiperp/parcel/test/integration/pages/Browser",
	"com/erpis/shiperp/parcel/test/integration/pages/App"
], function (Opa5, Common) {
	"use strict";
	Opa5.extendConfig({
		arrangements: new Common(),
		viewNamespace: "com.erpis.shiperp.parcel.view."
	});

	sap.ui.require([
		"com/erpis/shiperp/parcel/test/integration/WorklistJourney",
		"com/erpis/shiperp/parcel/test/integration/ObjectJourney",
		"com/erpis/shiperp/parcel/test/integration/NavigationJourney",
		"com/erpis/shiperp/parcel/test/integration/NotFoundJourney"
	], function () {
		QUnit.start();
	});
});