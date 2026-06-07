/*global QUnit*/

sap.ui.define([
	"com/erpis/shiperp/cancelshipewm/hr7/cancelshipewm/controller/App.controller"
], function (Controller) {
	"use strict";

	QUnit.module("App Controller");

	QUnit.test("I should test the App controller", function (assert) {
		var oAppController = new Controller();
		oAppController.onInit();
		assert.ok(oAppController);
	});

});