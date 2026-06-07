/*global location*/
jQuery.sap.require("com.erpis.shiperp.parcel.hr7.common.jquery_hotkeys");
sap.ui.define([
	"com/erpis/shiperp/parcel/hr7/controller/BaseController",
	"sap/ui/model/json/JSONModel",
	"com/erpis/shiperp/parcel/hr7/model/formatter",
	"sap/m/Token",
	"sap/ui/model/Filter",
	"sap/m/MessageBox",
	"sap/m/MessageToast",
	"com/erpis/shiperp/parcel/hr7/common/Utils",
	"com/erpis/shiperp/parcel/hr7/common/hotkeyInterface",
	"com/erpis/shiperp/parcel/hr7/common/DynamicView",
	"com/erpis/shiperp/parcel/hr7/common/UploadUtils",
	"com/erpis/shiperp/parcel/hr7/common/HttpHelper",
	"sap/ui/core/MessageType",
	"sap/ui/core/Fragment"
], function (BaseController, JSONModel, formatter, Token, Filter, MessageBox, MessageToast, Utils, HotkeyInterface, DynamicView,
	UploadUtils, HttpHelper, MessageType, Fragment) {
	"use strict";

	return BaseController.extend("com.erpis.shiperp.parcel.hr7.controller.Main", {
		oLogger: jQuery.sap.log.getLogger("com.erpis.shiperp.parcel.hr7.controller.Main"),
		formatter: formatter,
		oBundle: null, // i18n bundle class

		// Commonly used controller attributes
		sProfile: "", // Shipping profile
		sStation: "", // Shipping station
		sInputIDs: "", // Input IDs
		sInputType: "", // Input Type
		sObject: "", // Store basic/object value
		sObjectKey: "", // Store basic/object key value
		sCarrier: "", // Current Carrier
		sService: "", // Selected Service ID from rate
		sDefaultUseScale: "", // Default Use Scale,
		bCheckShipmentComplete: false, // Store the flag whether a shipment complete check is called already or not
		iOriginalExtScaleWeight: 0, // The first time read External scale -> store weight return here
		sOriginalExtScaleWeightUnit: "", // The first time read External scale -> store weight unit return here
		aFreightUnitShippedItems: [], // The list contain all freight Unit Items which already shipped.
		mFreightUnitHazmatItems: {}, // The hashmap (which key: HU number, value: hazmatlist) contain the hazmat which is already loaded.

		aOriginMasterSerialList: [], // The list contain the data from server.
		// Controlling Freight Unit table control state when model gets changed
		sHUWeightExtScaleChange: "", // This scenario is used when there is a change in weight after external scale is fetched
		oHUWeightChange: {
			HU: "",
			Index: 5
		}, // This scenario is used when there is a change in weight after user change weight manually
		bIsEnterPressedOnHU: false, // Flag to determine if Enter is pressed on input fields in HU table

		oContentTable: null, // Content table.
		oHUTable: null, // HU Table.
		oHULeftTable: null, // Left HU table on Advance Packing Dialog
		oHURightTable: null, // Right HU Table on Advance Packing Dialog.
		ScanInputEventCheck: {}, // store input ids which have already added event
		/* =========================================================== */
		/* lifecycle methods                                           */
		/* =========================================================== */
		/**
		 * Called when the worklist controller is instantiated.
		 * @public
		 */
		onInit: function () {
			this.oInputTypeDeferred = $.Deferred();

			// Set the controller property to be used globally in the controller
			this.oBundle = this.getResourceBundle();

			// Local Model for view
			var oViewModel = new JSONModel({
				Header: {
					ServiceName: "",
					ShipToCountry: "",
					ShipToState: "",
					BillingOption: "",
					TPCountry: ""
				},
				Contents: [],
				Freightunits: [],
				HTS: [],
				References: [],
				CarrierList: [],
				ServiceList: [],
				PreviousShipment: {
					carrier: "",
					service: "",
					billing_option: "",
					shipment_date: "",
					weight: "",
					rate: "",
					trackingno: ""
				},
				ETDUpload: {
					DeliveryNumber: "",
					CarrierCode: "",
					ImageID: "",
					ImageFile: "",
					DocFile: "",
					Usage: "",
					UploadType: "",
					ShippingPoint: "",
					CustomerReference: "",
					ShippingDocumentType: ""
				},
				ETDImageIds: [{
					key: "IMAGE_1",
					text: "IMAGE_1"
				}, {
					key: "IMAGE_2",
					text: "IMAGE_2"
				}, {
					key: "IMAGE_3",
					text: "IMAGE_3"
				}, {
					key: "IMAGE_4",
					text: "IMAGE_4"
				}, {
					key: "IMAGE_5",
					text: "IMAGE_5"
				}],
				ETDImageUsage: [{
					key: "SIGNATURE",
					text: "SIGNATURE"
				}, {
					key: "LETTER_HEAD",
					text: "LETTER_HEAD"
				}]
			});

			this.setModel(oViewModel, "local");

			this.getRouter().getRoute("main").attachPatternMatched(this._onObjectMatched, this);

			//*** add checkbox validator
			this.getView().byId("txtId").addValidator(function (args) {
				var text = args.text;
				return new Token({
					key: text,
					text: text
				});
			});

			// Initialize Message Model
			var oJSONModel = new JSONModel({
				aMessages: [],
				messagesLength: 0
			});
			this.setModel(oJSONModel, "messageModel");

			// hot key
			this.aHotKeyHanlders = [{
				keyCombination: "F8",
				control: this.getView(),
				fnHandler: this.handleHotKeyShip,
				hanlder: this
			}];

			HotkeyInterface.getInstance(this.getOwnerComponent()).bindHotKeys(this.aHotKeyHanlders);
		},

		/**
		 * Binds the view to the object path.
		 * @function
		 * @param {sap.ui.base.Event} oEvent pattern match event in route 'object'
		 * @private
		 */
		_onObjectMatched: function (oEvent) {
			this.showBusy();
			this.sStation = oEvent.getParameter("arguments").Station;
			this.sProfile = oEvent.getParameter("arguments").Profile;
			this.sInputType = oEvent.getParameter("arguments").InputType;
			this.sDelivery = oEvent.getParameter("arguments").Delivery;
			// Register event load for combobox input type
			this.byId("cbInputType").getBinding("items").attachDataReceived(this.onInputTypeLoaded(), this);
			// Initialize control visibility
			// Hide International, Importer, Specific Carrier tab
			this.byId("iconTabInternational").setVisible(false);
			this.byId("iconTabCarrier").setVisible(false);
			this.byId("iconTabImporter").setVisible(false);
			// Hide HTS button
			this.byId("btnHTS").setVisible(false);

			// Assign Table control
			this.oContentTable = this.byId("tableItem");
			this.oHUTable = this.byId("tableHU");

			//reset Data login
			this.onResetData();

			// remove mess login
			this.getModel("messageModel").setProperty("/messagesLength", 0);
			this.getModel("messageModel").setProperty("/aMessages", []);
			this.getModel("local").setProperty("/aMessagesValidate", []);
			this.getModel("local").setProperty("/aMessagesValidateShipment", []);
			$.when(this.oInputTypeDeferred).done(function () {
				if (this.sDelivery) {
					this._getDeliveryData(this.sDelivery);
				}
				this.hideBusy();
			}.bind(this));
		},

		/* =========================================================== */
		/* event handlers                                              */
		/* =========================================================== */

		_getDeliveryData: function (sDelivery) {
			this.byId("txtId").setValue(sDelivery);
			this.byId("txtId").setEditable(false);
			var sPath = "/ShipmentQuerySet";
			this.showBusy();
			this.getModel().read(sPath, {
				filters: [
					new Filter("inputtype", "EQ", this.sInputType),
					new Filter("inputids", "EQ", sDelivery),
					new Filter("profile", "EQ", this.sProfile),
					new Filter("shippingstation", "EQ", this.sStation)
				],
				urlParameters: {
					"$expand": "carrier_more_option/value_list,International/value_list,Freightunits/carrier_more_option/value_list,Freightunits/FreightunitHazmat,Freightunits/FreightunitItems,SerialSet,SerialSet/SerialItemSet,HTS,References,CarrierList,ServiceList,Contents,NaftaDetailSet"
				},
				success: function (oData) {
					if (oData.results.length !== 0 && oData.results[0].basic.carrier_data.carrier !== "") {
						// this.getModel("local").setProperty("/ShipmentQuery", oData.results[0]);
						this.getModel("local").setProperty("/ShipmentCarrierOptions", oData.results[0].carrier_more_option.results);
						this.getModel("local").setProperty("/Contents", oData.results[0].Contents.results);
						this.getModel("local").setProperty("/FreightunitHeaders", []);
						this.getModel("local").setProperty("/HTS", oData.results[0].HTS.results);
						this.getModel("local").setProperty("/References", oData.results[0].References.results);
						this.getModel("local").setProperty("/CarrierList", oData.results[0].CarrierList.results);
						this.getModel("local").setProperty("/ServiceList", oData.results[0].ServiceList.results);
						this.getModel("local").setProperty("/NaftaDetailSet", oData.results[0].NaftaDetailSet.results);
						this.getModel("local").setProperty("/basic", oData.results[0].basic);

						// construct serial list
						this.getModel("local").setProperty("/MasterSerialList", oData.results[0].SerialSet.results);
						this.aOriginMasterSerialList = jQuery.extend(true, [], oData.results[0].SerialSet.results);
						this.sObject = this.getModel("local").getProperty("/basic/hu_object/Object");
						this.sObjectKey = this.getModel("local").getProperty("/basic/hu_object/ObjectKey");
						this.sCarrier = oData.results[0].basic.carrier_data.carrier;
						this.bCheckShipmentComplete = false;

						if (oData.results[0].International.results.length > 0) {
							this.getModel("local").setProperty("/Internationaloptions", oData.results[0].International.results);
							this._displayShipmentInternationOprionTab();
						}

						this.getModel("local").setProperty("/Header", {
							ServiceName: "",
							ShipToCountry: "",
							ShipToState: "",
							BillingOption: "",
							TPCountry: ""
						});

						// Show header content
						this.byId("ObjectPageLayout").setShowHeaderContent(true);
						this.byId("ObjectPageLayout").setPreserveHeaderStateOnScroll(true);

						// Display tabs accordingly
						this._displayTabs();

						// Filter all the available dropdowns
						this._filterAllDropdowns();

						// Show Message Strip
						this._displayMessageStripHeader();

						//Hooks in Standard Controller for making controller extension
						if (this.afterScanWithoutTwoTable) {
							this.afterScanWithoutTwoTable(oData);
						}

						//Hooks in Standard Controller for making controller extension
						if (this.afterScanWithNotDefaultWeightScale) {
							this.afterScanWithNotDefaultWeightScale(oData);
						}

						// Read default scale weight
						var oDeferred = $.Deferred();
						oDeferred = this._getDefaultWeightScale();
						$.when(oDeferred).done(function () {
							this.oContentTable.removeSelections();
							this.oHUTable.removeSelections();
							this.getModel("local").setProperty("/Freightunits", oData.results[0].Freightunits.results);
							//Axo 4770
							this._updateShippingAndCarrMoreOpt();
							this.byId("cbWeightScale").fireSelectionChange();
							oDeferred = $.Deferred();
							this.hideBusy();
						}.bind(this));
					} else {
						MessageBox.warning(this.oBundle.getText("NoDataFound"));
						// Enable inputs fields
						this.byId("txtId").setEditable(true);
						this.hideBusy();
					}
				}.bind(this),
				error: function (oError) {
					// reset view
					this.byId("txtId").setEditable(true);
					this.getModel("local").setData({});
					this._handleODataError(oError);
					this.hideBusy();
				}.bind(this)
			});
		},

		handleHotKeyShip: function () {
			var oShipBtn = this.byId("idShipmentBtn");
			if (oShipBtn.getEnabled()) {
				oShipBtn.firePress();
			}
		},

		unBindAllHotKeys: function () {
			HotkeyInterface.getInstance(this.getOwnerComponent()).unBindHotKeys(this.aHotKeyHanlders);
		},

		// When dropdown input type loaded
		onInputTypeLoaded: function () {
			this.byId("cbInputType").setSelectedKey(this.sInputType);
			this.oInputTypeDeferred.resolve();
		},

		onInputTypeChange: function (oEvent) {
			this.onResetData();
		},

		// Enter press on the search text on the header toolbar
		onSubmit: function (oEvent) {
			this.byId("ObjectPageLayout").scrollToSection(this.byId("iconTabPacking").getId());
			if (this.byId("cbInputType").getSelectedKey() !== "") {
				this.sInputType = this.byId("cbInputType").getSelectedKey();
				this.byId("cbInputType").setValueState("None");
			} else {
				MessageBox.error(this.oBundle.getText("missingInputType"));
				this.byId("cbInputType").setValueState("Error");
				return;
			}

			if (oEvent.getSource().getTokens().length === 0 && oEvent.getSource().getValue() === "") {
				MessageBox.error(this.oBundle.getText("missingInputID"));
				this.byId("txtId").setValueState("Error");
				return;
			} else {
				this.byId("txtId").setValueState("None");
			}

			this.sInputIDs = "";
			//check indicator
			this.indicator = "";
			this.idnumber = "";
			if (oEvent.getSource().getTokens().length > 0) {
				for (var i = 0; i < oEvent.getSource().getTokens().length; i++) {
					var sTokenValue = oEvent.getSource().getTokens()[i].getText();
					this.sInputIDs += sTokenValue + "|";
				}
			} else {
				this.sInputIDs = oEvent.getSource().getValue();
			}

			var sPath = "/ShipmentQuerySet";
			this.showBusy();
			this.getModel().read(sPath, {
				filters: [
					new Filter("inputtype", "EQ", this.sInputType),
					new Filter("inputids", "EQ", this.sInputIDs),
					new Filter("profile", "EQ", this.sProfile),
					new Filter("shippingstation", "EQ", this.sStation)
				],
				urlParameters: {
					"$expand": "carrier_more_option/value_list,International/value_list,Freightunits/carrier_more_option/value_list,Freightunits/FreightunitHazmat,Freightunits/FreightunitItems,SerialSet,SerialSet/SerialItemSet,HTS,References,CarrierList,ServiceList,Contents,NaftaDetailSet"
				},
				success: function (oData) {
					if (oData.results.length !== 0 && oData.results[0].basic.carrier_data.carrier !== "") {
						// this.getModel("local").setProperty("/ShipmentQuery", oData.results[0]);
						this.getModel("local").setProperty("/ShipmentCarrierOptions", oData.results[0].carrier_more_option.results);
						this.getModel("local").setProperty("/Contents", oData.results[0].Contents.results);
						this.getModel("local").setProperty("/FreightunitHeaders", []);
						this.getModel("local").setProperty("/HTS", oData.results[0].HTS.results);
						this.getModel("local").setProperty("/References", oData.results[0].References.results);
						this.getModel("local").setProperty("/CarrierList", oData.results[0].CarrierList.results);
						this.getModel("local").setProperty("/ServiceList", oData.results[0].ServiceList.results);
						this.getModel("local").setProperty("/NaftaDetailSet", oData.results[0].NaftaDetailSet.results);
						this.getModel("local").setProperty("/basic", oData.results[0].basic);

						// construct serial list
						this.getModel("local").setProperty("/MasterSerialList", oData.results[0].SerialSet.results);
						this.aOriginMasterSerialList = jQuery.extend(true, [], oData.results[0].SerialSet.results);
						// var data1 = '';
						// var data2 = ''
						// var aresult = this.iterateObjects(data1, data2);
						// Keep the common properties at controller state
						this.sObject = this.getModel("local").getProperty("/basic/hu_object/Object");
						this.sObjectKey = this.getModel("local").getProperty("/basic/hu_object/ObjectKey");
						this.sCarrier = oData.results[0].basic.carrier_data.carrier;
						this.bCheckShipmentComplete = false;
						//
						if (oData.results[0].International.results.length > 0) {
							this.getModel("local").setProperty("/Internationaloptions", oData.results[0].International.results);
							this._displayShipmentInternationOprionTab();
						}
						// //Dummy data for test
						// this.getModel("local").setProperty("/Orientation", [{
						// 	fieldgroup: "COD",
						// 	filedname: "Recipient",
						// 	visible: true,
						// 	enable: false,
						// 	require: true
						// }, {
						// 	fieldgroup: "CDD",
						// 	filedname: "Recipient",
						// 	visible: false,
						// 	enable: true,
						// 	require: false
						// }]);
						// Initialize Header node of local model (used in header message strip)
						this.getModel("local").setProperty("/Header", {
							ServiceName: "",
							ShipToCountry: "",
							ShipToState: "",
							BillingOption: "",
							TPCountry: ""
						});

						// Show header content
						this.byId("ObjectPageLayout").setShowHeaderContent(true);
						this.byId("ObjectPageLayout").setPreserveHeaderStateOnScroll(true);

						// Display tabs accordingly
						this._displayTabs();

						// Filter all the available dropdowns
						this._filterAllDropdowns();

						// Show Message Strip
						this._displayMessageStripHeader();

						// Disable inputs fields
						this.byId("txtId").setEditable(false);

						//Hooks in Standard Controller for making controller extension
						if (this.afterScanWithoutTwoTable) {
							this.afterScanWithoutTwoTable(oData);
						}

						//Hooks in Standard Controller for making controller extension
						if (this.afterScanWithNotDefaultWeightScale) {
							this.afterScanWithNotDefaultWeightScale(oData);
						}

						// Read default scale weight
						var oDeferred = $.Deferred();
						oDeferred = this._getDefaultWeightScale();
						$.when(oDeferred).done(function () {
							this.oContentTable.removeSelections();
							this.oHUTable.removeSelections();
							// if (this.getModel("local").getProperty("/UseScale") !== "0002") {
							// 	this.getModel("local").setProperty("/Freightunits", oData.results[0].Freightunits.results);
							// }
							this.getModel("local").setProperty("/Freightunits", oData.results[0].Freightunits.results);
							//Axo 4770
							this._updateShippingAndCarrMoreOpt();

							//Binding empty field when PickupReadyDate empty
							//Commend out by Tim 9/9/2021
							/*
							if (oData.results[0].basic.carrier_data.carrier === "FDXE") {
								this._bindEmptyPickupReadyTimeFDXE();
							} else if (oData.results[0].basic.carrier_data.carrier === "FDXG") {
								this._bindEmptyPickupReadyTimeFDXG();
							}
							*/
							this.byId("cbWeightScale").fireSelectionChange();
							oDeferred = $.Deferred();
							this.hideBusy();
						}.bind(this));
					} else {
						MessageBox.warning(this.oBundle.getText("NoDataFound"));
						// Enable inputs fields
						this.byId("txtId").setEditable(true);
						this.hideBusy();
					}
				}.bind(this),
				error: function (oError) {
					// reset view
					this.byId("txtId").setEditable(true);
					this.getModel("local").setData({});
					this._handleODataError(oError);
					this.hideBusy();
				}.bind(this)
			});
		},

		// When Freight unit table selection changed
		onSelectionChange: function (oEvent) {
			var oTab = oEvent.getSource();
			var aList = oTab.getSelectedItems();
			var bFlag = false;
			var oHU;
			// un select item in case of non mps
			var sMPSStatus = this.getModel("local").getProperty("/basic/carrier_data/mps/mps");
			var sMPSType = this.getModel("local").getProperty("/basic/carrier_data/mps/mpstype");
			if (sMPSStatus === "X" && sMPSType === "02") {
				// return true;
			} else {
				if (aList.length > 1) {
					MessageBox.error(this.oBundle.getText("errorMPSSelectMsg"));
					// select all
					if (aList.length === oTab.getItems().length) {
						oTab.removeSelections();
					} else {
						oEvent.getParameter("listItem").setSelected(false);
					}
					return;
				}
			}

			// Check if any freight unit has tracking number
			for (var i = 0; i < aList.length; i++) {
				oHU = aList[i];
				if (oHU.getBindingContext("local").getObject().trackingnumber !== "") {
					if (oEvent.getParameter("selected")) {
						bFlag = true;
						break;
					}
				}
			}
			if (bFlag) {
				// Unselect Items with Tracking number available
				for (i = 0; i < aList.length; i++) {
					oHU = aList[i];
					if (oHU.getBindingContext("local").getObject().trackingnumber !== "") {
						if (oEvent.getParameter("selected")) {
							oHU.setSelected(false);
						}
					}
				}
				MessageBox.warning(this.oBundle.getText("SelectHUTableActionNotAllowed"));
			}
		},

		// Add Default HU section
		onAddDefaultHU: function () {
			if (!this.oDialogDefaultHU) {
				this.oDialogDefaultHU = sap.ui.xmlfragment("com.erpis.shiperp.parcel.hr7.fragment.CreateDefaultHUDialog", this);
				this.getView().addDependent(this.oDialogDefaultHU);
			}
			this.oDialogDefaultHU.open();
		},

		// iterateObjects: function (source, target) {
		// 	var that = this;
		// 	var updatedSource = Object.assign({}, source); // Tạo một bản sao của source để cập nhật giá trị
		// 	if (Array.isArray(source) || Array.isArray(target)) {
		// 		source.forEach(function (itemSource, index) {
		// 			updatedSource[index] = that.iterateObjects(itemSource, target[index]);
		// 		});
		// 	} else {
		// 		for (var key in source) {
		// 			if (key === "__metadata") {
		// 				delete source.__metadata;
		// 			} else if (source.hasOwnProperty(key)) {
		// 				if (
		// 					typeof source[key] === "object" &&
		// 					source[key] !== null &&
		// 					typeof target[key] === "object" &&
		// 					target[key] !== null
		// 				) {
		// 					if (Object.keys(source[key]).length > 0) {
		// 						updatedSource[key] = that.iterateObjects(source[key], target[key]);
		// 					}
		// 				} else if (source[key] !== target[key]) {
		// 					if (!updatedSource.hasOwnProperty('markforchange')) {
		// 						updatedSource = Object.assign({
		// 							markforchange: ""
		// 						}, source);
		// 					} else if (updatedSource.markforchange === "") {
		// 						updatedSource.markforchange += key;
		// 					} else {
		// 						updatedSource.markforchange += ", " + key;
		// 					}
		// 				}
		// 			}
		// 		}
		// 	}

		// 	return updatedSource;
		// },

		// Add New HU section
		onAddNewHU: function () {
			if (!this.oDialogNewHU) {
				this.oDialogNewHU = sap.ui.xmlfragment("com.erpis.shiperp.parcel.hr7.fragment.CreateHUDialog", this);
				this.getView().addDependent(this.oDialogNewHU);
			}
			this.oDialogNewHU.open();
		},

		onCreateHU: function () {
			this._createHU();
		},

		onCloseNewHUDialog: function () {
			this.oDialogNewHU.close();
		},

		// Delete HU section
		onDeleteHU: function () {
			var aSelectedHUs = [];
			var bDeleteAllFlag = false;
			// Get the selected HUs depending on the Packing scenario
			if (this._getPackingScenario() === "01") { // Main Screen Scenario
				aSelectedHUs = this.oHUTable.getSelectedItems();
				if (aSelectedHUs.length === this.oHUTable.getItems().length) {
					bDeleteAllFlag = true;
				}
			} else if (this._getPackingScenario() === "02") { // Pack by Material Dialog
				aSelectedHUs = this.oHUTable.getSelectedItems();
				if (aSelectedHUs.length === this.oHUTable.getItems().length) {
					bDeleteAllFlag = true;
				}
			} else if (this._getPackingScenario() === "03") { // Pack by HU Dialog
				aSelectedHUs = this.oHURightTable.getSelectedItems();
				if (aSelectedHUs.length === this.oHURightTable.getItems().length) {
					bDeleteAllFlag = true;
				}
			} else { // Default
				aSelectedHUs = this.oHUTable.getSelectedItems();
				if (aSelectedHUs.length === this.oHUTable.getItems().length) {
					bDeleteAllFlag = true;
				}
			}

			// Validate if any HU is selected
			if (aSelectedHUs.length === 0) {
				MessageBox.error(this.oBundle.getText("SelectHUDelete"));
				return;
			}
			// Validate if any selected HU(s) has tracking number
			if (this._numOfShippedItems(aSelectedHUs) > 0) {
				MessageBox.error(this.oBundle.getText("errorSelectedShippedItemsMsg"));
				return;
			}
			MessageBox.confirm(this.oBundle.getText("confirmDeleteHUMessage"), {
				title: this.oBundle.getText("ConfirmDeletion"),
				actions: [sap.m.MessageBox.Action.YES, sap.m.MessageBox.Action.NO],
				initialFocus: sap.m.MessageBox.Action.YES,
				onClose: function (oAction) {
					if (oAction === MessageBox.Action.YES) {
						this._deleteHUs(bDeleteAllFlag);
					}
				}.bind(this)
			});
		},

		onDeleteAllHU: function () {
			MessageBox.confirm(this.oBundle.getText("confirmDeleteAllHUMessage"), {
				title: this.oBundle.getText("ConfirmDeletion"),
				actions: [sap.m.MessageBox.Action.YES, sap.m.MessageBox.Action.NO],
				initialFocus: sap.m.MessageBox.Action.YES,
				onClose: function (oAction) {
					if (oAction === MessageBox.Action.YES) {
						this._deleteHUs(true);
					}
				}.bind(this)
			});
		},

		// Press on Reference button on Small Parcel tab
		onBtnPressRefChange: function () {
			this._oRefDialog = Utils.getFragment("", "parcel.DialogRefDisplay", this);
			this._oRefDialog.open();
		},

		onCloseRefereneceDialog: function () {
			this._oRefDialog.close();
		},

		// Press on HTS button
		onOpenHTS: function () {
			this.showBusy();
			this.getModel().read("/ShipmentQuerySet", {
				filters: [
					new Filter("inputtype", "EQ", this.sInputType),
					new Filter("inputids", "EQ", this.sInputIDs),
					new Filter("profile", "EQ", this.sProfile),
					new Filter("shippingstation", "EQ", this.sStation)
				],
				urlParameters: {
					"$expand": "HTS"
				},
				success: function (oData) {
					this.hideBusy();
					if (oData.results[0].HTS.results) {
						this.getModel("local").setProperty("/HTS", oData.results[0].HTS.results);
					}
					this._oHTSDialog = Utils.getFragment("", "HTSDisplayDialog", this);
					this._oHTSDialog.open();
				}.bind(this),
				error: function (oError) {
					this._handleODataError(oError);
					this.hideBusy();
				}.bind(this)
			});
		},

		onCloseHTSDialog: function () {
			this._oHTSDialog.close();
		},

		onCheckBreakBulk: function (oEvent) {
			this._checkBreakBulk();
		},
		//added by Tim Axo 4174
		_checkingHuInside: function (freightUnitItem) {
			var bIsInside = true;
			var rootHuId = freightUnitItem.hu_id;
			var aFreightUnitItems = freightUnitItem.FreightunitItems.results;
			if (aFreightUnitItems.length < 1) {
				bIsInside = false;
				return bIsInside;
			}
			var aDiffHu = [];
			aFreightUnitItems.forEach(function (fuItem) {
				if (fuItem.hu_id !== rootHuId) {
					aDiffHu.push(fuItem);
				}
			});
			if (aDiffHu.length > 0) {
				bIsInside = false;
			}
			return bIsInside;

		},
		onOpenHUItemsDialog: function (oEvent) {
			var oObject = oEvent.getSource().getBindingContext("local").getObject();
			//added by Tim handle hirachy level based on Axo 4174
			var oFreightUnit = Object.assign({}, oObject);

			//Axo 4760 Scenario 1, 2 always display packing overview
			//calling packing overview
			var fuKey = formatter.removeLeadingZero(oFreightUnit.freightunitkey);
			this._showPackingOverview(fuKey, "06"); //specify for HU click Tim Added 22/9/2021

			/*
				oFreightUnit.isOverviewPack = this._checkingHuInside(oFreightUnit); // for testing
				if (oFreightUnit.isOverviewPack) {
					//calling packing overview
					var fuKey = formatter.removeLeadingZero(oFreightUnit.freightunitkey);
					this._showPackingOverview(fuKey, "06"); //specify for HU click Tim Added 22/9/2021
				} else {
					this.getModel("local").setProperty("/FreightunitItems", oObject.FreightunitItems.results);
					if (!this._oHUItemsDialog) {
						this._oHUItemsDialog = sap.ui.xmlfragment("com.erpis.shiperp.parcel.hr7.fragment.packing.HUItemsDialog", this);
						this.getView().addDependent(this._oHUItemsDialog);
					}
					this._oHUItemsDialog.open();
				}*/
		},

		onCloseHUItemsDialog: function () {
			this._oHUItemsDialog.close();
		},

		onSearchMaterial: function () {
			var oFilter = new Filter("material", "Contains", this.byId("txtMaterial").getValue());
			this.oContentTable.getBinding("items").filter(oFilter);
		},

		onValidateNumber: function (oEvent) {
			var sNewValue = oEvent.getParameter("newValue");
			var sBalance = oEvent.getSource().getBindingContext("local").getObject().openqty;
			if (parseInt(sNewValue, 10) > parseInt(sBalance, 10)) {
				oEvent.getSource().setValueState("Error");
				MessageBox.error(this.oBundle.getText("partialQuantityError"));
			} else {
				oEvent.getSource().setValueState("None");
			}
		},
		onUpdateDomesticDialog: function (oEvent) {
			var oControl = oEvent.getSource();
			var sCountryCode = oControl.getSelectedKey();
			var sRegionId = oControl.data("nextUpdate");
			if (sRegionId) {
				this._updateRegionDialog(sRegionId, sCountryCode);
			}
		},
		onUpdateDomestic: function (oEvent) {
			var oControl = oEvent.getSource();
			var sCountryCode = oControl.getSelectedKey();
			var sRegionId = oControl.data("nextUpdate");
			this.showBusy();
			this._displayMessageStripHeader();
			this.getModel().callFunction("/GetDomesticFlag", {
				"method": "GET",
				urlParameters: {
					Carrier: this.sCarrier,
					FromCountry: this.getModel("local").getProperty("/basic/partners/shipfrom/address/country"),
					FromState: this.getModel("local").getProperty("/basic/partners/shipfrom/address/state"),
					ToCountry: this.getModel("local").getProperty("/basic/partners/shipto/address/country"),
					ToState: this.getModel("local").getProperty("/basic/partners/shipto/address/state")
				},
				success: function (oData) {
					if (oData.GetDomesticFlag.flag === "") {
						this.getModel("local").setProperty("/basic/shipment_flags/domestic", false);
						this.byId("btnHTS").setVisible(true);
						this.byId("iconTabInternational").setVisible(true);
						this.byId("iconTabImporter").setVisible(true);
					} else {
						this.getModel("local").setProperty("/basic/shipment_flags/domestic", true);
						this._displayTabs();
					}

					//Axo 4813
					this._updateShippingAndCarrMoreOpt();
					if (sRegionId) {
						this._updateRegion(sRegionId, sCountryCode);
					}
					this._filterAllDropdowns();
					this.hideBusy();
				}.bind(this),
				error: function (oError) {
					this._handleODataError(oError);
					this.hideBusy();
				}.bind(this)
			});
			if (oEvent.getSource().getId().indexOf("cbShipToCountry") !== -1) {
				this._scanINTL();
			}
		},

		_scanINTL: function () {
			this.showBusy();
			var oRequestData = this._getINTL();
			this.getModel().callFunction("/GetINTL", {
				method: "GET",
				urlParameters: oRequestData,
				success: function (oData) {
					if (oData.results.length > 0) {
						this.getModel("local").setProperty("/Internationaloptions", oData.results);
						this._displayShipmentInternationOprionTab();
					}
					this.hideBusy();
				}.bind(this),
				error: function (oError) {
					this._handleODataError(oError);
					this.hideBusy();
				}.bind(this)
			});
		},
		_getINTL: function () {
			var sCarrier = this.byId("cbCarrier").getSelectedKey();
			var sShipToCountry = this.byId("cbShipToCountry").getSelectedKey();
			var sShipFromContry = this.getModel("local").getProperty("/basic/partners/shipfrom/address/country");
			var oData = {
				ShipToNumber: this.sInputIDs,
				Carrier: sCarrier,
				ShipToCountry: sShipToCountry,
				ShipFromCountry: sShipFromContry,
				TransactionClass: "P"
			};
			return oData;
		},

		onChangeBillingOption: function () {
			// Update Message Strip Header
			this._displayMessageStripHeader();
			// Update Billing information
			this._updateBillingInformation();
		},

		// Change Carrier event
		onCarrierChange: function (oEvent) {

			if (this.oMoreOptionDialog || this.oShipmentCarrierOptionTab) {
				var oControl = oEvent.getSource();
				MessageBox.warning(
					this.oBundle.getText("ManuallyenterdataText"), {
						actions: [sap.m.MessageBox.Action.OK, sap.m.MessageBox.Action.CANCEL],
						onClose: function (sAction) {
							if (sAction === "OK") {
								var sCarrier = oControl.getSelectedItem().getKey();
								this.sCarrier = sCarrier;
								// Reset the More Option Dialog
								this.oMoreOptionDialog = null;
								//resset shipment
								if (this.oShipmentCarrierOptionTab.getBlocks()[0] instanceof sap.m.FlexBox) {
									if (this.oShipmentCarrierOptionTab.getBlocks()[0].getItems()[0] instanceof sap.m.FlexBox) {
										this.oShipmentCarrierOptionTab.getBlocks()[0].getItems()[0].removeAllContent();
									} else {
										this.oShipmentCarrierOptionTab.getBlocks()[0].getItems()[1].removeAllItems()
									}
								} else {
									var oCurrForm = this.oShipmentCarrierOptionTab.getBlocks()[0];
									if (oCurrForm) {
										oCurrForm.removeAllContent();
									}
								}
								this.oShipmentCarrierOptionTab.removeAllBlocks();
								this.oShipmentCarrierOptionTab = null;
								// resset shipment for International
								if (this.oShipmentInternationalOptions) {
									if (this.oShipmentInternationalOptions.getBlocks()[0] instanceof sap.m.FlexBox) {
										if (this.oShipmentInternationalOptions.getBlocks()[0].getItems()[0] instanceof sap.m.FlexBox) {
											this.oShipmentInternationalOptions.getBlocks()[0].getItems()[0].removeAllContent();
										} else {
											this.oShipmentInternationalOptions.getBlocks()[0].getItems()[1].removeAllItems()
										}
									} else {
										var oCurrFormInter = this.oShipmentInternationalOptions.getBlocks()[0];
										if (oCurrFormInter) {
											oCurrFormInter.removeAllContent();
										}
									}
									this.oShipmentInternationalOptions.removeAllBlocks();
									this.oShipmentInternationalOptions = null;
								}
								// Update basic node from new carrier
								this._changeCarrier(sCarrier);
							} else {
								oControl.setSelectedKey(this.sCarrier);
							}
						}.bind(this)
					}
				);
			} else {
				this.sCarrier = oEvent.getParameter("selectedItem").getKey();
				// Reset the More Option Dialog
				this.oMoreOptionDialog = null;
				// Update basic node from new carrier
				this._changeCarrier(this.sCarrier);

			}

		},

		onServiceChange: function (oEvent) {
			this._displayMessageStripHeader();
		},

		onChangeReturnService: function () {
			this._changeReturnService();
		},

		// Reset button click
		onResetData: function () {
			this.showBusy();
			this.byId("ObjectPageLayout").scrollToSection(this.byId("iconTabPacking").getId());
			setTimeout(this._resetData.bind(this), 1000); //eslint-disable-line
		},

		// Single rate/Shop rate/Optimization section
		onSingleRateClick: function () {
			var sMPSStatus = this.getModel("local").getProperty("/basic/carrier_data/mps/mps");
			var aSelectedHUs = this.oHUTable.getSelectedItems();
			var sMPSType = this.getModel("local").getProperty("/basic/carrier_data/mps/mpstype");
			if (sMPSStatus === "X" && sMPSType === "02") {
				// return true;
			} else {
				if (aSelectedHUs.length !== 1) {
					MessageBox.error(this.oBundle.getText("errorMPSSelectMsg"));
					return;
				}
			}
			this._getFreightCost("S");
		},

		onRateShopClick: function () {
			var sMPSStatus = this.getModel("local").getProperty("/basic/carrier_data/mps/mps");
			var aSelectedHUs = this.oHUTable.getSelectedItems();
			var sMPSType = this.getModel("local").getProperty("/basic/carrier_data/mps/mpstype");
			if (sMPSStatus === "X" && sMPSType === "02") {
				// return true;
			} else {
				if (aSelectedHUs.length !== 1) {
					MessageBox.error(this.oBundle.getText("errorMPSSelectMsg"));
					return;
				}
			}
			this._getFreightCost("R");
		},

		onOptimizationClick: function () {
			var sMPSStatus = this.getModel("local").getProperty("/basic/carrier_data/mps/mps");
			var aSelectedHUs = this.oHUTable.getSelectedItems();
			var sMPSType = this.getModel("local").getProperty("/basic/carrier_data/mps/mpstype");
			if (sMPSStatus === "X" && sMPSType === "02") {
				// return true;
			} else {
				if (aSelectedHUs.length !== 1) {
					MessageBox.error(this.oBundle.getText("errorMPSSelectMsg"));
					return;
				}
			}
			this._getFreightCost("O");
		},

		onCloseRateDialog: function () {
			this.oRateDialog.close();
		},

		onShowPricingDetail: function () {
			if (sap.ui.getCore().byId("tableRates").getSelectedItem() === null) {
				MessageBox.error(this.oBundle.getText("SelectItemToContinue"));
				return;
			}
			if (!this.oRatePricingDialog) {
				this.oRatePricingDialog = sap.ui.xmlfragment("com.erpis.shiperp.parcel.hr7.fragment.RatePricingsDialog", this);
				this.getView().addDependent(this.oRatePricingDialog);
			}
			var oObject = sap.ui.getCore().byId("tableRates").getSelectedItem().getBindingContext("local").getObject();
			var oRatePricingTemplate = sap.ui.xmlfragment("com.erpis.shiperp.parcel.hr7.fragment.RatePricingColumnListItem", this);
			var oBindingInfo = {
				path: "local>/RatePricings",
				template: oRatePricingTemplate,
				filters: [
					new Filter("Carrier", "EQ", oObject.carrierid),
					new Filter("Service", "EQ", oObject.serviceid)
				]
			};
			sap.ui.getCore().byId("tblRatePricingList").bindItems(oBindingInfo);
			this.oRatePricingDialog.open();
		},

		onCloseRatePricingDialog: function () {
			this.oRatePricingDialog.close();
		},

		onShowAnalysisDetail: function () {
			if (sap.ui.getCore().byId("tableRates").getSelectedItem() === null) {
				MessageBox.error(this.oBundle.getText("SelectItemToContinue"));
				return;
			}
			this._getRateAnalysis();
		},

		onAfterRateAnalysisOpen: function () {
			var oObject = sap.ui.getCore().byId("tableRates").getSelectedItem().getBindingContext("local").getObject();
			var aAnalysis = this.getModel("local").getProperty("/RateAnalysis");
			try {
				var aOutput = [];
				var bFound = false;
				// Filter the rate analysis where carrier and service equal the selected rate entry
				for (var i = 0; i < aAnalysis.length; i++) {
					if (aAnalysis[i].Carrier === "" && aAnalysis[i].Service === "") {
						for (var j = 0; j < aOutput.length; j++) {
							if (aOutput[j].NodeId === aAnalysis[i].NodeId) {
								bFound = true;
								break;
							}
						}
						if (!bFound) {
							aOutput.push(aAnalysis[i]);
						} else {
							bFound = false;
						}
					}
					if (aAnalysis[i].Carrier === oObject.carrierid && aAnalysis[i].Service === oObject.serviceid) {
						aOutput.push(aAnalysis[i]);
					}
				}
				this.getModel("local").setProperty("/CarrierRateAnalysis", this.treeify(aOutput));
			} catch (exc) {
				this.getModel("local").setProperty("/CarrierRateAnalysis", []);
				this.oLogger.info("No Carrier Rate Analysis");
			}
		},

		onChangeRateAnalysisLine: function (oEvent) {
			var oObject = oEvent.getParameter("rowContext").getObject();
			var oTitle = sap.ui.getCore().byId("txtTabDesc");
			if (oObject.TabName === "" && oObject.TabKey === "") {
				return;
			}
			oTitle.setText(oObject.NodeDesc);
			if (this.analyRequest) {
				this.analyRequest.abort();
			}
			this.analyRequest = this.getModel().callFunction("/GetConditionValue", {
				"method": "GET",
				urlParameters: {
					TabName: oObject.Tabname,
					TabKey: oObject.Tabkey,
					Sdata: oObject.Sdata
				},
				success: function (oData) {
					this.getModel("local").setProperty("/MessagesToFields", oData.results);
				}.bind(this),
				error: function (oError) {
					this._handleODataError(oError);
					this.getModel("local").setProperty("/MessagesToFields", []);
				}.bind(this)
			});
		},

		onCloseRateAnalysisDialog: function () {
			this.oRateAnalysisDialog.close();
		},

		onMessagesFilter: function (oEvent) {
			var sValue = oEvent.getSource().getValue();
			var oAllFilter = new Filter([
				new Filter("Text1", sap.ui.model.FilterOperator.Contains, sValue),
				new Filter("Text2", sap.ui.model.FilterOperator.Contains, sValue),
				new Filter("Text3", sap.ui.model.FilterOperator.Contains, sValue)
			], false);
			sap.ui.getCore().byId("tabHdr").getBinding("items").filter([oAllFilter]);
		},

		onShowRateDetail: function () {
			if (sap.ui.getCore().byId("tableRates").getSelectedItem() === null) {
				MessageBox.error(this.oBundle.getText("SelectItemToContinue"));
				return;
			}
			if (!this.oRateDetailDialog) {
				this.oRateDetailDialog = sap.ui.xmlfragment("com.erpis.shiperp.parcel.hr7.fragment.RateDetailsDialog", this);
				this.getView().addDependent(this.oRateDetailDialog);
			}
			var oObject = sap.ui.getCore().byId("tableRates").getSelectedItem().getBindingContext("local").getObject();
			var oRateDetailTemplate = sap.ui.xmlfragment("com.erpis.shiperp.parcel.hr7.fragment.RateDetailColumnListItem", this);
			var oBindingInfo = {
				path: "local>/RateDetails",
				template: oRateDetailTemplate,
				filters: [
					new Filter("Carrier", "EQ", oObject.carrierid),
					new Filter("Service", "EQ", oObject.serviceid)
				]
			};
			sap.ui.getCore().byId("tblRateDetailList").bindItems(oBindingInfo);
			this.oRateDetailDialog.open();
		},

		onCloseRateDetailDialog: function () {
			this.oRateDetailDialog.close();
		},

		onRateSelected: function () {
			if (sap.ui.getCore().byId("tableRates").getSelectedItem() === null) {
				MessageBox.error(this.oBundle.getText("SelectItemToContinue"));
				return;
			}
			var oRate = sap.ui.getCore().byId("tableRates").getSelectedItem().getBindingContext("local").getObject();
			this.getModel("local").setProperty("/basic/carrier_data/carrier", oRate.carrierid);
			this.sCarrier = oRate.carrierid;
			this.sService = oRate.serviceid;
			this.oRateDialog.close();

			// Update basic node from new carrier
			this._changeCarrier((oRate.serviceid) ? oRate.serviceid : "");
		},

		// Pack and Unpack section
		onPackPartial: function () {
			var aSelectedItems = this.oContentTable.getSelectedItems();
			if (aSelectedItems.length !== 1) {
				MessageBox.error(this.oBundle.getText("SelectItemPackPartial"));
				return;
			}
			var aSelectedHUs = this.oHUTable.getSelectedItems();
			if (aSelectedHUs.length !== 1) {
				MessageBox.error(this.oBundle.getText("SelectHUPack"));
				return;
			}
			this._packPartial();
		},

		onPackMaterial: function () {
			var aSelectedItems = this.oContentTable.getSelectedItems();
			if (aSelectedItems.length === 0) {
				MessageBox.error(this.oBundle.getText("SelectItemPack"));
				return;
			}
			var aSelectedHUs = this.oHUTable.getSelectedItems();
			if (aSelectedHUs.length !== 1) {
				MessageBox.error(this.oBundle.getText("SelectHUPack"));
				return;
			}

			this._packMaterial();
		},

		onUnpack: function () {
			var aSelectedHUs = this.oHUTable.getSelectedItems();
			if (aSelectedHUs.length === 0) {
				MessageBox.error(this.oBundle.getText("SelectHUUnPack"));
				return;
			}
			if (this._numOfShippedItems(aSelectedHUs) > 0) {
				MessageBox.error(this.oBundle.getText("errorSelectedShippedItemsMsg"));
				return;
			}
			MessageBox.confirm(this.oBundle.getText("confirmUnPackHUMessage"), {
				title: this.oBundle.getText("ConfirmUnPacking"),
				actions: [sap.m.MessageBox.Action.YES, sap.m.MessageBox.Action.NO],
				initialFocus: sap.m.MessageBox.Action.YES,
				onClose: function (oAction) {
					if (oAction === MessageBox.Action.YES) {
						this._unpack(aSelectedHUs);
					}
				}.bind(this)
			});
		},

		onExecute: function () {
			var sMPSStatus = this.getModel("local").getProperty("/basic/carrier_data/mps/mps");
			var aSelectedHUs = this.oHUTable.getSelectedItems();
			var sMPSType = this.getModel("local").getProperty("/basic/carrier_data/mps/mpstype");
			if (sMPSStatus === "X" && sMPSType === "02") {
				// return true;
			} else {
				if (aSelectedHUs.length !== 1) {
					MessageBox.error(this.oBundle.getText("errorMPSSelectMsg"));
					return;
				}
			}
			var isForceExecute = false;
			var aItems = this.oHUTable.getItems();
			for (var i = 0; i < aItems.length; i++) {
				if (aItems[i].getHighlight() === sap.ui.core.ValueState.Error) {
					isForceExecute = true;
					break;
				}
			}
			this._execute();

			// if (isForceExecute) {
			// 	MessageBox.confirm(this.oBundle.getText("configforceshipmentMsg"), {
			// 		title: this.oBundle.getText("shipTitle"),
			// 		actions: [sap.m.MessageBox.Action.YES, sap.m.MessageBox.Action.NO],
			// 		initialFocus: sap.m.MessageBox.Action.YES,
			// 		onClose: function (oAction) {
			// 			if (oAction === MessageBox.Action.YES) {
			// 				this._execute("ExecuteForce");
			// 			} else {
			// 				MessageBox.warning(this.oBundle.getText("incompleteHazmat"));
			// 			}
			// 		}.bind(this)
			// 	});
			//  } //else {
			// 	MessageBox.confirm(this.oBundle.getText("configmshipmentMsg"), {
			// 		title: this.oBundle.getText("shipTitle"),
			// 		actions: [sap.m.MessageBox.Action.YES, sap.m.MessageBox.Action.NO],
			// 		initialFocus: sap.m.MessageBox.Action.YES,
			// 		onClose: function (oAction) {
			// 			if (oAction === MessageBox.Action.YES) {
			// 				this._execute();
			// 			}
			// 		}.bind(this)
			// 	});
			// }
		},
		onAcceptNumber: function () {
			var iValue = sap.ui.getCore().byId("txtLTL").getValue();
			this._execute(null, iValue, null);
			this.oDialogLTL.close();
		},

		onCloseProNumber: function () {
			this.oDialogLTL.close();
		},

		onChangeScaleOption: function () {
			var oTable = this.byId("tableHU");
			var oFirstRow = oTable.getItems()[0];
			oTable.setSelectedItem(oFirstRow);
			var aHUs = this.byId("tableHU").getItems();
			var oObject, oButton;
			// This block is used to handle reupdate toggle button pressed state when model gets changed
			if (aHUs) {
				for (var j = 0; j < aHUs.length; j++) {
					oObject = aHUs[j].getBindingContext("local").getObject();
					if (oObject.freightunitkey) {
						oButton = aHUs[j].getCells()[aHUs[j].getCells().length - 1].getItems()[1];
						oButton.setPressed(false);
					}
				}
			}
			if (this.getModel("local").getProperty("/UseScale") === "0001") {
				var aFreightunits = this.getModel("local").getProperty("/Freightunits");
				if (this._numOfShippedHU(aFreightunits) === aFreightunits.length) {
					return;
				}
				var oDeferred = this._getExternalScale();
				$.when(oTable, oFirstRow, oDeferred).done(function () {
					oButton = oFirstRow.getCells()[oFirstRow.getCells().length - 1].getItems()[1];
					oButton.setPressed(!oButton.getPressed());
				}.bind(this));
			} else if (this.getModel("local").getProperty("/UseScale") === "0002") {
				this._refreshPackingData(true);
				this.enableEditFreightUnits(false);
				this.getModel("local").setProperty("/aFreightUnitEdits", []);
			} else if (this.getModel("local").getProperty("/UseScale") === "0003") {
				this.enableEditFreightUnits(true);
			} else {
				// this._refreshPackingData(true);
				this.enableEditFreightUnits(false);
			}
		},

		onMassUpdateScales: function () {
			var oMassUpdateScale = {
				weight: "",
				length: "",
				width: "",
				height: ""
			};
			this.getModel("local").setProperty("/oMassUpdateScale", oMassUpdateScale);
			this.oMassScaleUpdateDialog = Utils.getFragment("", "MassScaleUpdateDialog", this);
			this.oMassScaleUpdateDialog.open();
		},

		onCloseMassScaleUpdateDialog: function () {
			this.oMassScaleUpdateDialog.close();
		},

		onConfirmMassUpdateScale: function () {
			var oMassUpdateScale = this.getModel("local").getProperty("/oMassUpdateScale");
			var aFreightUnits = this.getModel("local").getProperty("/Freightunits");

			aFreightUnits.forEach(function (item) {
				if (item.trackingnumber !== "") {
					return;
				}
				if (oMassUpdateScale.weight) {
					item.weight = oMassUpdateScale.weight;
				}
				if (oMassUpdateScale.length) {
					item.length = oMassUpdateScale.length;
				}
				if (oMassUpdateScale.width) {
					item.width = oMassUpdateScale.width;
				}
				if (oMassUpdateScale.height) {
					item.height = oMassUpdateScale.height;
				}
			});

			this.getModel("local").setProperty("/Freightunits", aFreightUnits);
			this.oMassScaleUpdateDialog.close();
		},

		onNAFTAPress: function () {
			this.oNaftaDialog = Utils.getFragment("", "NAFTADialog", this);
			this.oNaftaDialog.open();
		},

		onCloseNAFTAialog: function () {
			this.oNaftaDialog.close();
		},

		onGoNextLineItem: function (oEvent) {
			this.bIsEnterPressedOnHU = true;
			var oControl = oEvent.getSource();
			var oSelectedItem = oControl.getParent().getParent();

			var oTable = this.getView().byId("tableHU");
			var oItems = oTable.getItems();
			var oNextItemSelected = null;
			for (var i = 0; i < oItems.length; i++) {
				// check if exist next item or not.
				if (oSelectedItem === oItems[i] && (i + 1) <= (oItems.length - 1)) {
					oNextItemSelected = oItems[i + 1];
					break;
				}
			}
			if (!oNextItemSelected) {
				return;
			}
			var oFirstInput = this.getFirstCellEdit(oNextItemSelected, 3);
			if (oFirstInput) {
				oFirstInput.focus();
				$("#" + oFirstInput.getId() + "-inner").select();
			}
		},

		onGoToLengthColumn: function (oEvent) {
			this.bIsEnterPressedOnHU = false;
			this.oHUWeightChange.HU = oEvent.getSource().getBindingContext("local").getObject().freightunitkey;
			this.oHUWeightChange.Index = 5;
		},

		onGoToWidthColumn: function (oEvent) {
			this.bIsEnterPressedOnHU = false;
			this.oHUWeightChange.HU = oEvent.getSource().getBindingContext("local").getObject().freightunitkey;
			this.oHUWeightChange.Index = 6;
		},

		onGoToHeightColumn: function (oEvent) {
			this.bIsEnterPressedOnHU = false;
			this.oHUWeightChange.HU = oEvent.getSource().getBindingContext("local").getObject().freightunitkey;
			this.oHUWeightChange.Index = 7;
		},

		onGoToUoMColumn: function (oEvent) {
			this.bIsEnterPressedOnHU = false;
			this.oHUWeightChange.HU = oEvent.getSource().getBindingContext("local").getObject().freightunitkey;
			this.oHUWeightChange.Index = 8;
		},

		onSerialPress: function () {
			if (!this.oSerialDialog) {
				this.oSerialDialog = sap.ui.xmlfragment("com.erpis.shiperp.parcel.hr7.fragment.SerialDialog", this);
				this.getView().addDependent(this.oSerialDialog);
			}

			this.aFreightUnitShippedItems = this._getShippedItems();
			var oCarousel = sap.ui.getCore().byId("serialCarousel");
			var oPages = oCarousel.getPages();
			if (oPages.length > 0) {
				oCarousel.setActivePage(oPages[0]);
				oCarousel.firePageChanged({
					newActivePageId: oPages[0].getId()
				});
			}
			this.oSerialDialog.open();
		},

		onSerialItemChange: function (oEvent) {
			var sActivePageId = oEvent.getParameter("newActivePageId");
			var oActivePage = sap.ui.getCore().byId(sActivePageId);
			var oData = oActivePage.getBindingContext("local").getObject();
			this._displaySerialList(oData);
			var bEditable = true;
			this.aFreightUnitShippedItems.forEach(function (item) {
				if (item.material === oData.matnr && item.delivery === oData.vbeln) {
					bEditable = false;
					return;
				}
			});

			this.getModel("local").setProperty("/bSerialItemEditable", bEditable);
		},
		onAddEventSerialScan: function (oEvent) {
			var oControl = oEvent.getSource();
			if (!this.ScanInputEventCheck[oControl.getId()]) {
				oControl.addEventDelegate({
					onsapfocusleave: this.onChangeSerialInputText.bind(this)
				});
				this.ScanInputEventCheck[oControl.getId()] = true;
			}
		},

		onChangeSerialInputText: function (oEvent) {
			var oControl;
			if (oEvent.type === "sapfocusleave") {
				oControl = jQuery(oEvent.target).control()[0];
			} else {
				oControl = oEvent.getSource();
			}
			var sString = oControl.getValue();
			if (!sString) {
				return;
			}
			var sArr = sString.split(" ");
			var aSerialList = this.getModel("local").getProperty("/SelectedSerial/SerialItemSet/results");
			sArr.forEach(function (item) {
				var text = item.trim();
				for (var i = 0; i < aSerialList.length; i++) {
					if (aSerialList[i].SERNR === text) {
						var sMsg = this.oBundle.getText("duplicateSerial", [text]);
						this.aMessage = MessageBox.error(sMsg);
						return;
					}
				}
				for (i = 0; i < aSerialList.length; i++) {
					if (aSerialList[i].SERNR === "") {
						aSerialList[i].SERNR = text;
						break;
					}
				}
			}.bind(this));
			this.getModel("local").setProperty("/SelectedSerial/SerialItemSet/results", aSerialList);
			oControl.setValue("");
		},

		addValidatorForScan: function (oEvent) {
			var oControl = oEvent.getSource();
			oControl.addValidator(function (args) {
				// oControl.removeAllValidators();
				oControl.setValue("");
				var text = args.text;
				var aSerialList = this.getModel("local").getProperty("/SelectedSerial/SerialItemSet/results");
				for (var i = 0; i < aSerialList.length; i++) {
					if (aSerialList[i].SERNR === text) {
						var sMsg = this.oBundle.getText("duplicateSerial", [text]);
						this.aMessage = MessageBox.error(sMsg);
						return;
					}
				}
				for (i = 0; i < aSerialList.length; i++) {
					if (aSerialList[i].SERNR === "") {
						aSerialList[i].SERNR = text;
						break;
					}
				}
				this.getModel("local").setProperty("/SelectedSerial/SerialItemSet/results", aSerialList);

			}.bind(this));
		},

		onClearSerials: function (oEvent) {
			var aSerialList = this.getModel("local").getProperty("/SelectedSerial/SerialItemSet/results");
			for (var i = 0; i < aSerialList.length; i++) {
				aSerialList[i].SERNR = "";
			}
			this.getModel("local").setProperty("/SelectedSerial/SerialItemSet/results", aSerialList);
		},

		onCloseSerialDialog: function () {
			// reset serial list to origin
			this.getModel("local").setProperty("/MasterSerialList", jQuery.extend(true, [], this.aOriginMasterSerialList));
			this.oSerialDialog.close();
		},

		onValidateSerialInput: function (oEvent) {
			var oInput = oEvent.getSource();
			var sValue = oInput.getValue();
			if (!sValue) {
				return;
			}
			var aSerialSet = this.getModel("local").getProperty("/SelectedSerial/SerialItemSet").results || [];
			var count = 0;
			for (var i = 0; i < aSerialSet.length; i++) {
				var oItem = aSerialSet[i];
				if (oItem.SERNR === sValue) {
					count++;
				}
				if (count === 2) { // duplicate
					var sMsg = this.oBundle.getText("duplicateSerial", [sValue]);
					MessageBox.error(sMsg);
					oInput.setValue("");
					return;
				}
			}
		},

		onPostSerialsPress: function () {
			var oRequestData = this._generatePostSerialsUsecase();
			this.showBusy();
			this.getModel().create("/ShipmentQuerySet", oRequestData, {
				success: function (oData) {
					// Update serial list
					this.getModel("local").setProperty("/MasterSerialList", oData.SerialSet.results);
					// update origin serial list
					this.aOriginMasterSerialList = jQuery.extend(true, [], oData.SerialSet.results);
					MessageToast.show(this.oBundle.getText("serialpostsuccess"));
					this.hideBusy();
					this.oSerialDialog.close();
				}.bind(this),
				error: function (oError) {
					this._handleODataError(oError);
					this.hideBusy();
				}.bind(this)
			});
		},

		onChangeDeliverySerial: function (oEvent) {
			var oControl = oEvent.getSource();
			var sSelectedDelivery = oControl.getValue();
			this._displaySerialList(sSelectedDelivery);
		},

		onValidateAddressPress: function (oEvent) {
			var oRequestData = this._generateValidateAddressUsecase();
			var evt = oEvent.getSource();
			this.showBusy();
			this.getModel().create("/ShipmentQuerySet", oRequestData, {
				success: function (oData) {
					var oNewAddress = oData.basic.partners.shipto;
					var aMsg = this._generateMessages(oData.ReturnMessages.results);
					this.getModel("local").setProperty("/aMessagesValidate", aMsg);
					this.getModel("local").setProperty("/NewAddress", oNewAddress);
					this.oValidateAdressDialog = Utils.getFragment("", "ValidateAddressDialog", this);
					this.oValidateAdressDialog.open();
					this.hideBusy();
				}.bind(this),
				error: function (oError) {
					this._handleODataError(oError);
					this.hideBusy();
				}.bind(this)
			});
		},

		_getMessagePopover: function () {
			if (!this._messagePopover) {
				this._messagePopover = sap.ui.xmlfragment("com.erpis.shiperp.parcel.hr7.fragment.ValidateAddressDialog", this);
			}
			return this._messagePopover;
		},

		_generateMessages: function (aParamMessages) {
			var aMessages = [];
			for (var i = 0; i < aParamMessages.length; i++) {
				var oMessage = this._generateMessageObject(aParamMessages[i]);
				if (oMessage) {
					aMessages.push(oMessage);
				}
			}
			return aMessages;
		},
		_generateMessageObject: function (oPassMessage) {
			var oMessage = {
				type: "Warning",
				title: oPassMessage.Message,
				description: ""
			};
			switch (oPassMessage.Type) {
			case "E":
				oMessage.type = MessageType.Error;
				break;
			case "W":
				oMessage.type = MessageType.Warning;
				break;
			case "I":
				oMessage.type = MessageType.Information;
				break;
			case "S":
				oMessage.type = MessageType.Success;
				break;
			default:
				oMessage.type = MessageType.Warning;
				break;
			}
			return oMessage;
		},

		onValidateEmailDialogClose: function () {
			this.oValidateAdressDialog.close();
		},

		onValidateAddressConfirmPress: function () {
			var oNewAddress = this.getModel("local").getProperty("/NewAddress");
			var OldAddress = this.getModel("local").getProperty("/basic/partners/shipto");
			this._copyObject(OldAddress, oNewAddress);
			this.getModel("local").setProperty("/basic/partners/shipto", OldAddress);
			this.oValidateAdressDialog.close();
		},

		onEditItemPackingPress: function (oEvent) {
			var oControl = oEvent.getSource();
			var bEditable = oControl.getPressed();
			var oData = oControl.getBindingContext("local").getObject();
			var aFreightUnitEdits = this.getModel("local").getProperty("/aFreightUnitEdits") || [];
			if (bEditable) {
				if (this.getModel("local").getProperty("/UseScale") === "0001") {
					// Make column length editable
					oEvent.getSource().getParent().getParent().getCells()[5].getItems()[0].setVisible(true);
					oEvent.getSource().getParent().getParent().getCells()[5].getItems()[1].setVisible(false);
					// Make column width editable
					oEvent.getSource().getParent().getParent().getCells()[6].getItems()[0].setVisible(true);
					oEvent.getSource().getParent().getParent().getCells()[6].getItems()[1].setVisible(false);
					// Make column height editable
					oEvent.getSource().getParent().getParent().getCells()[7].getItems()[0].setVisible(true);
					oEvent.getSource().getParent().getParent().getCells()[7].getItems()[1].setVisible(false);
					// Make column UoM editable
					oEvent.getSource().getParent().getParent().getCells()[8].getItems()[0].setVisible(true);
					oEvent.getSource().getParent().getParent().getCells()[8].getItems()[1].setVisible(false);
					aFreightUnitEdits.push(oData.freightunitkey);
				} else if (this.getModel("local").getProperty("/UseScale") === "0002" || this.getModel("local").getProperty("/UseScale") ===
					"0004") {
					aFreightUnitEdits.push(oData.freightunitkey);
					this.enableEditFreighUnit(oEvent.getSource().getParent().getParent(), true);
				}
			} else {
				// remove
				var index = aFreightUnitEdits.indexOf(oData.freightunitkey);
				if (index > -1) {
					aFreightUnitEdits.splice(index, 1);
				}
				// Make column weight uneditable
				oEvent.getSource().getParent().getParent().getCells()[3].getItems()[0].setVisible(false);
				oEvent.getSource().getParent().getParent().getCells()[3].getItems()[1].setVisible(true);
				// Make column length uneditable
				oEvent.getSource().getParent().getParent().getCells()[5].getItems()[0].setVisible(false);
				oEvent.getSource().getParent().getParent().getCells()[5].getItems()[1].setVisible(true);
				// Make column width uneditable
				oEvent.getSource().getParent().getParent().getCells()[6].getItems()[0].setVisible(false);
				oEvent.getSource().getParent().getParent().getCells()[6].getItems()[1].setVisible(true);
				// Make column height uneditable
				oEvent.getSource().getParent().getParent().getCells()[7].getItems()[0].setVisible(false);
				oEvent.getSource().getParent().getParent().getCells()[7].getItems()[1].setVisible(true);
				// Make column UoM uneditable
				oEvent.getSource().getParent().getParent().getCells()[8].getItems()[0].setVisible(false);
				oEvent.getSource().getParent().getParent().getCells()[8].getItems()[1].setVisible(true);
			}
			this.getModel("local").setProperty("/aFreightUnitEdits", aFreightUnitEdits);
		},

		onHUTableUpdateFinished: function (oEvent) {
			var aHUs = oEvent.getSource().getItems();
			var oObject;
			var oButton, oInput;
			// This block is used to handle reupdate toggle button pressed state when model gets changed
			if (this.sHUWeightExtScaleChange !== "") {
				for (var j = 0; j < aHUs.length; j++) {
					oObject = aHUs[j].getBindingContext("local").getObject();
					if (oObject.freightunitkey === this.sHUWeightExtScaleChange) {
						oButton = aHUs[j].getCells()[aHUs[j].getCells().length - 1].getItems()[1];
						oButton.setPressed(oButton.getPressed());
						this.sHUWeightExtScaleChange = "";
						break;
					}
				}
			}
			// This block is used to handle tab function when model gets changed
			if (this.oHUWeightChange.HU !== "" && !this.bIsEnterPressedOnHU) {
				for (var i = 0; i < aHUs.length; i++) {
					oObject = aHUs[i].getBindingContext("local").getObject();
					if (oObject.freightunitkey === this.oHUWeightChange.HU) {
						this.oHUWeightChange.HU = "";
						oInput = aHUs[i].getCells()[this.oHUWeightChange.Index].getItems()[0];
						oInput.focus();
						$("#" + oInput.getId() + "-inner").select();
						break;
					}
				}
			}
			// This block is used to handle hazmat highlight indicator when data changed and hazmat indicator is flagged
			if (this.getModel("local").getProperty("/basic/shipment_flags/HazmatExist")) {
				for (var i = 0; i < aHUs.length; i++) {
					oObject = aHUs[i].getBindingContext("local").getObject();
					if (this.mFreightUnitHazmatItems[oObject.freightunitkey] == null) {
						if (oObject.FreightunitHazmat.results) {
							if (oObject.FreightunitHazmat.results.length > 0) {
								aHUs[i].setHighlight(sap.ui.core.ValueState.Error);
								aHUs[i].setTooltip(this.oBundle.getText("hazmatNotMaintainedTooltip"));
							} else {
								aHUs[i].setHighlight(sap.ui.core.ValueState.None);
								aHUs[i].setTooltip("");
							}
						} else {
							aHUs[i].setHighlight(sap.ui.core.ValueState.None);
							aHUs[i].setTooltip("");
						}
					} else {
						var bMaintained = true;
						for (var j = 0; j < this.mFreightUnitHazmatItems[oObject.freightunitkey].length; j++) {
							if (this.mFreightUnitHazmatItems[oObject.freightunitkey][j].Selected === "X") {
								if (this.mFreightUnitHazmatItems[oObject.freightunitkey][j].Updated === "") {
									bMaintained = false;
									break;
								}
							} else {
								continue;
							}
						}
						if (bMaintained) {
							aHUs[i].setHighlight("Success");
							aHUs[i].setTooltip(this.oBundle.getText("hazmatMaintainedTooltip"));
						} else {
							if (oObject.FreightunitHazmat.results) {
								if (oObject.FreightunitHazmat.results.length > 0) {
									aHUs[i].setHighlight(sap.ui.core.ValueState.Error);
									aHUs[i].setTooltip(this.oBundle.getText("hazmatNotMaintainedTooltip"));
								} else {
									aHUs[i].setHighlight(sap.ui.core.ValueState.None);
									aHUs[i].setTooltip("");
								}
							} else {
								aHUs[i].setHighlight(sap.ui.core.ValueState.None);
								aHUs[i].setTooltip("");
							}
						}
					}
				}
			}
			// This block is used to check if shipment is complete
			if (!this.bCheckShipmentComplete) {
				this._checkShipmentComplete();
			}

		},
		_updateShippingAndCarrMoreOpt: function () {
			// This block is used to update the shipping status and disable Execute buttons
			this._updateShippingStatus();

			//Added by Tim 19/11/2021 Axo 4770
			this._displayShipmentCarrierMoreOptTab();
		},

		onReupdateItemScalePress: function (oEvent) {
			var oDeferred = $.Deferred();
			oDeferred = this.onBuildGetExternalScale(oEvent);
			$.when(oDeferred).done(function (oData) {
				this.oButtonpress.setPressed(oData);
				this.hideBusy();
			}.bind(this));
		},

		onBuildGetExternalScale: function (oEvent) {
			var oDeferred = $.Deferred();
			this.iOriginalExtScaleWeight = 0;
			this.sOriginalExtScaleWeightUnit = "";
			var oObject = oEvent.getSource().getBindingContext("local").getObject();
			var sWeight = oObject.weight;
			this.oButtonpress = oEvent.getSource();
			if (oEvent.getSource().getPressed()) {
				this.showBusy();
				this.getModel().callFunction("/GetExternalScale", {
					urlParameters: {
						ShippingStation: this.sStation
					},
					success: function (oData) {
						if (oData.GetExternalScale.Weight && oData.GetExternalScale.WeightUnit) {
							var aHUs = this.getModel("local").getProperty("/Freightunits");
							for (var j = 0; j < aHUs.length; j++) {
								if (aHUs[j].freightunitkey === oObject.freightunitkey) {
									if (parseFloat(sWeight) === parseFloat(oData.GetExternalScale.Weight)) {
										this.sHUWeightExtScaleChange = "";
									} else {
										this.sHUWeightExtScaleChange = oObject.freightunitkey;
										aHUs[j].weight = parseFloat(oData.GetExternalScale.Weight).toFixed(2);
										aHUs[j].weight_unit = oData.GetExternalScale.WeightUnit;
									}
									break;
								}
							}
							this.getModel("local").setProperty("/Freightunits", aHUs);
						}
						oDeferred.resolve(true);
						this.hideBusy();
					}.bind(this),
					error: function (oError) {
						this._handleODataError(oError);
						oDeferred.resolve(false);
						this.hideBusy();
					}.bind(this)
				});
			} else {
				var aHUs = this.getModel("local").getProperty("/Freightunits");
				for (var j = 0; j < aHUs.length; j++) {
					if (aHUs[j].freightunitkey === oObject.freightunitkey) {
						aHUs[j].weight = parseFloat(this.iOriginalExtScaleWeight).toFixed(2);
						aHUs[j].weight_unit = this.sOriginalExtScaleWeightUnit;
					}
				}
				this.getModel("local").setProperty("/Freightunits", aHUs);
				oDeferred.resolve(false);
			}
			return oDeferred;
		},

		onShowTrackingNumberPress: function (oEvent) {
			var oControl = oEvent.getSource();
			var oData = oControl.getBindingContext("local").getObject();
			var sTrackingNo = oData.trackingnumber;
			var oPopover = new sap.m.Popover({
				showHeader: false,
				content: [
					new sap.m.Text({
						text: sTrackingNo
					}).addStyleClass("sapUiTinyMargin")
				]
			});
			oPopover.openBy(oControl);
		},

		onHazardousPress: function () {
			var aSelectedHUs = this.oHUTable.getSelectedItems();
			if (aSelectedHUs.length === 0) {
				MessageBox.error(this.oBundle.getText("hazmatselectedMsgError"));
				return;
			}
			if (aSelectedHUs.length > 1) {
				MessageBox.error(this.oBundle.getText("hazmatselectedMsg"));
				return;
			}
			this._getHazardous();
		},

		onHazardousClose: function () {
			var oSelectedHu = this.oHUTable.getSelectedItem();
			var sKey = oSelectedHu.getBindingContext("local").getObject().freightunitkey;
			if (oSelectedHu.getBindingContext("local").getObject().FreightunitHazmat.results) {
				if (oSelectedHu.getBindingContext("local").getObject().FreightunitHazmat.results.length > 0 && oSelectedHu.getBindingContext(
						"local").getObject().FreightunitHazmat.results[0].Updated == "") {
					oSelectedHu.setHighlight("Error");
					oSelectedHu.setTooltip(this.oBundle.getText("hazmatNotMaintainedTooltip"));
					delete this.mFreightUnitHazmatItems[sKey];
				} else if (oSelectedHu.getBindingContext("local").getObject().FreightunitHazmat.results.length > 0 && oSelectedHu.getBindingContext(
						"local").getObject().FreightunitHazmat.results[0].Updated == "X") {
					oSelectedHu.setHighlight("Success");
					oSelectedHu.setTooltip("");
				} else {
					oSelectedHu.setHighlight("None");
					oSelectedHu.setTooltip("");
					delete this.mFreightUnitHazmatItems[sKey];
				}
			} else {
				if (oSelectedHu.getBindingContext("local").getObject().FreightunitHazmat.length > 0 && oSelectedHu.getBindingContext("local").getObject()
					.FreightunitHazmat[0].Updated == "") {
					oSelectedHu.setHighlight("Error");
					oSelectedHu.setTooltip(this.oBundle.getText("hazmatNotMaintainedTooltip"));
					delete this.mFreightUnitHazmatItems[sKey];
				} else if (oSelectedHu.getBindingContext("local").getObject().FreightunitHazmat.length > 0 && oSelectedHu.getBindingContext(
						"local").getObject().FreightunitHazmat[0].Updated == "X") {
					oSelectedHu.setHighlight("Success");
					oSelectedHu.setTooltip("");
				} else {
					oSelectedHu.setHighlight("None");
					oSelectedHu.setTooltip("");
					delete this.mFreightUnitHazmatItems[sKey];
				}
			}

			// delete this.mFreightUnitHazmatItems[sKey];
			this.oHazmatDialog.close();
		},

		onHazmatUpdatePress: function () {
			var oBinding = this.byId(this.getView().createId("hazmatDetailContainer")).getBindingContext("local");
			if (!oBinding) {
				// no data selected
				return;
			}
			//handle data hazmat option
			this.handleHazmatOptionDataBeforeGenerate();
			this._validateHazmat();
		},

		onHazmatContinuePress: function () {
			//handle data hazmat option
			this.handleHazmatOptionDataBeforeGenerate();
			this._validateAllHazmat();
		},

		onHazmatSelectedChangePress: function (oEvent) {
			var oControl = oEvent.getSource();
			var oBinding = oControl.getBindingContext("local");
			var oData = oBinding.getObject();
			if (oControl.getSelected()) {
				oData.Selected = "X";
				this.indicator = "X";
			} else {
				oData.Selected = "";
				this.indicator = "";
			}
			this.getModel("local").setProperty(oBinding.getPath(), oData);
		},

		onDotIDNumberLinkPress: function (oEvent) {
			var oControl = oEvent.getSource();
			var oView = this.getView();
			var oBinding = this.getModel("local");
			var oBindingData = oControl.getBindingContext("local").getObject();
			oBinding.setProperty("/BindingHazmatOpt", oBindingData.freightunit_hazmatopt.results);
			//Binding hazmatoption
			this._getHazmatoptionAndTable();
			//handle data hazmat option
			this.handleHazmatOptionDataBeforeGenerate();

			if (oBindingData.Selected !== "X") {
				MessageBox.information(this.oBundle.getText("hazmatDotIdNotSelectedMsg"));
				return;
			}

			var oDetailContainer = this.byId(oView.createId("hazmatDetailContainer"));
			var sPath = "local>" + oControl.getBindingContext("local").getPath();
			this._updatePackingInstr(oControl.getBindingContext("local"));
			oDetailContainer.bindElement(sPath);
			this.onCalculatResult();
		},

		onHazmatDialogBeforeClose: function (oEvent) {
			var oDetailContainer = this.byId(this.getView().createId("hazmatDetailContainer"));
			oDetailContainer.unbindElement("local");
		},

		onAddHazmatShowDialogPress: function () {
			var oNewHazmat = {
				Dotidnumber: ""
			};
			this.getModel("local").setProperty("/NewHazMatItem", oNewHazmat);
			this.oHazmatAddItemDialog = Utils.getFragment("", "AddHazmatDialog", this);
			this.byId(this.getView().createId("cbDotnumber")).setValue("");
			this.oHazmatAddItemDialog.open();
		},

		onAddHazmatClose: function () {
			this.oHazmatAddItemDialog.close();
		},

		onHazmatAddItemPress: function () {
			var oNewHazmat = this.getModel("local").getProperty("/NewHazMatItem");
			var aFreightunitHazmats = this.getModel("local").getProperty("/FreightunitHazmats");
			var oFreightUnit = this.oHUTable.getSelectedItem().getBindingContext("local").getObject();
			oNewHazmat.freightunitkey = oFreightUnit.freightunitkey;
			oNewHazmat.hu_id = oFreightUnit.hu_id;
			oNewHazmat.linenumber = aFreightunitHazmats.length + 1;
			oNewHazmat.shipmentid = "";

			aFreightunitHazmats.push(oNewHazmat);
			this.getModel("local").setProperty("/FreightunitHazmats", aFreightunitHazmats);
			this.oHazmatAddItemDialog.close();
		},

		onPCDGunCBChange: function (oEvent) {
			var oControl = oEvent.getSource();
			var sKey = oControl.getSelectedKey();
			if (sKey === "") {
				return;
			}
			sKey = oControl.getSelectedItem().getBindingContext().getObject().tkui + sKey;
			oControl.setValue(sKey);
			var fieldValue = oControl.getSelectedItem().getBindingContext().getObject();
			this.showBusy();
			this.getModel().callFunction("/GetSingleHazmat", {
				urlParameters: {
					HazmatID: sKey,
					Dothazmatsubclas: fieldValue.dothazmatsubclas,
					Packinggroup: fieldValue.packinggroup,
					Dothazmatclass: fieldValue.dothazmatclass,
					Dgregulation: fieldValue.dgregulation
				},
				success: function (oData) {
					oData.Dotidnumber = sKey;
					this.getModel("local").setProperty("/NewHazMatItem", oData);
					this.hideBusy();
				}.bind(this),
				error: function (oError) {
					this._handleODataError(oError);
					this.hideBusy();
				}.bind(this)
			});
		},

		onAuthorizationChange: function (oEvent) {
			var oControl = oEvent.getSource();
			this._updatePackingInstr(oControl.getBindingContext("local"));
			if (oEvent) {
				this._updateHazmatChange(oEvent.getSource().getBindingContext("local"));
			}
		},

		onCalculatResult: function (oEvent) {
			var oView = this.getView();
			var dResult = 0;
			var oActualQty = this.byId(oView.createId("actualqtyId"));
			var oNoOfContainer = this.byId(oView.createId("noOfContainerId"));
			try {
				var fActualQty = oActualQty.getValue();
				var fNoOfConainer = oNoOfContainer.getValue();
				if (fActualQty === "") {
					fActualQty = 0;
					oActualQty.setValue(fActualQty);
				}
				if (fNoOfConainer === "") {
					fNoOfConainer = 0;
					oNoOfContainer.setValue(fNoOfConainer);
				}

				dResult = parseFloat(fActualQty, 10) * parseFloat(fNoOfConainer, 10);
			} catch (ex) {
				// 
			}
			this.byId(oView.createId("resultId")).setValue(dResult.toFixed(3));
			if (oEvent) {
				this._updateHazmatChange(oEvent.getSource().getBindingContext("local"));
			}
		},

		onCheckHazmatChange: function (oEvent) {
			if (oEvent) {
				this._updateHazmatChange(oEvent.getSource().getBindingContext("local"));
			}
		},

		onPackMatValueRequested: function () {
			var oPackMatDlg = Utils.getFragment("", "PackMatDialog", this);
			oPackMatDlg.open();
		},

		onPackMatValueHelpClose: function (oEvent) {
			oEvent.getSource().getBinding("items").filter([]);
		},

		onPackMatValueHelpSearch: function (oEvent) {
			var sValue = oEvent.getParameter("value");
			var oFilterID = new Filter("Matnr", sap.ui.model.FilterOperator.Contains, sValue);
			var oFilterValue = new Filter("Maktx", sap.ui.model.FilterOperator.Contains, sValue);
			var oAllFilter = new Filter([oFilterID, oFilterValue], false);

			var oBinding = oEvent.getSource().getBinding("items");
			oBinding.filter([oAllFilter]);
		},

		onPackMatConfirm: function (oEvent) {
			var oSelectedItem = oEvent.getParameter("selectedItem");
			if (oSelectedItem) {
				var oPackMat = sap.ui.getCore().byId("txtPackMat");
				oPackMat.setValue(oSelectedItem.getTitle());
			}
			oEvent.getSource().getBinding("items").filter([]);
		},

		onReprint: function () {
			this.oReprintDialog = Utils.getFragment("", "ReprintDisplayDialog", this);
			var oReprintTemplate = sap.ui.xmlfragment("com.erpis.shiperp.parcel.hr7.fragment.ReprintColumnListItem", this);
			// var oFilter
			this.getModel("local").setProperty("/ReprintFilter", {
				carrier: this.sCarrier,
				trackingnumber: "",
				delivery: []
			});
			var oBindingInfo = {
				path: "/xSERPERPxI_PCPRINT",
				filters: [
					new Filter("deleted", "EQ", "")
				],
				template: oReprintTemplate
			};
			this.byId(this.getView().createId("tblReprintList")).bindItems(oBindingInfo);
			this.oReprintDialog.open();
			//*** add checkbox validator
			this.byId(this.getView().createId("txtDeliveryPrint")).addValidator(function (args) {
				var text = args.text;
				return new Token({
					key: text,
					text: text
				});
			});
		},

		onCloseReprintDialog: function () {
			this.oReprintDialog.close();
		},

		onFilterReprintPress: function () {
			var oFilterCriteria = this.getModel("local").getProperty("/ReprintFilter");
			var oBinding = this.byId(this.getView().createId("tblReprintList")).getBinding("items");

			var aFilters = [];
			for (var sProperty in oFilterCriteria) {
				if (!oFilterCriteria.hasOwnProperty(sProperty)) {
					continue;
				}
				if (!oFilterCriteria[sProperty]) {
					continue;
				}

				switch (sProperty) {
				case "delivery":
					var aDeliveries = this._getDeliveryFromHeader(this.byId(this.getView().createId("txtDeliveryPrint")));
					for (var i = 0; i < aDeliveries.length; i++) {
						aFilters.push(new Filter(sProperty, sap.ui.model.FilterOperator.Contains, aDeliveries[i].key));
					}
					break;
				case "erdat":
					aFilters.push(new Filter(sProperty, sap.ui.model.FilterOperator.EQ, oFilterCriteria[sProperty]));
					break;
				default:
					aFilters.push(new Filter(sProperty, sap.ui.model.FilterOperator.Contains, oFilterCriteria[sProperty]));
					break;
				}
			}
			oBinding.filter(aFilters);
		},

		onConfirmReprint: function () {
			var oSelectedItem = this.byId(this.getView().createId("tblReprintList")).getSelectedItem().getBindingContext().getObject();
			this.showBusy();
			this.getModel().callFunction("/ReprintOutput", {
				urlParameters: {
					ObjectKey: oSelectedItem.objectkey,
					ObjectType: oSelectedItem.objecttype,
					TrackingNo: oSelectedItem.trackingnumber,
					Delivery: oSelectedItem.delivery
				},
				success: function (oData) {
					// Print Shipment Labels
					if (oData.results) {
						if (oData.results.length === 0) {
							MessageBox.error(this.oBundle.getText("NoPrintPreview"));
						} else {
							MessageToast.show(this.oBundle.getText("ReprintSuccess"));
							var sPath;
							for (var i = 0; i < oData.results.length; i++) {

								var shipmentLabelItem = oData.results[i];
								sPath = this.getModel().sServiceUrl + "/ShipmentLabelSet(shipmentid='',Guid='" + shipmentLabelItem.Guid +
									"')/$value";
								//Handle ZPL Axo 4780
								if (shipmentLabelItem.OutputType.indexOf("ZPL") !== -1) {
									this.onHandleReprintZPLDataType(sPath, true);
									return;
								} else {
									//other type download
									sap.m.URLHelper.redirect(sPath, true);
								}

							}

						}
					}
					this.hideBusy();
				}.bind(this),
				error: function (oError) {
					this._handleODataError(oError);
					this.hideBusy();
				}.bind(this)
			});
		},

		onReprintDialogAfterOpen: function () {
			this.onFilterReprintPress();
		},
		/**
		 * Handle ZPL type Axo 4780
		 * lastModifiedBy: Tim
		 * lastModifiedDate: 18/11/2021
		 * */
		onHandleReprintZPLDataType: function (sPath, bHideBusy) {
			var fnSuccess = function (oData) {
				console.log('ZPL Handle Completed', oData); //eslint-disable-line
				if (bHideBusy) {
					this.hideBusy();
				}

			}.bind(this);
			var fnError = function (oError) {
				console.log('ZPL Handle Err', oError); //eslint-disable-line
				if (bHideBusy) {
					this.hideBusy();
				}
			}.bind(this);
			HttpHelper.getData(sPath, fnSuccess, fnError);

		},
		onAnalysisDataFound: function (oEvent) {
			var iCount = oEvent.getSource().getItems().length;
			oEvent.getSource().setVisible(iCount !== 0);
		},

		onPrintHazmat: function (oEvent) {
			this._printHazmat();
		},

		onPrintPreviewHazmat: function (oEvent) {
			this._printPreviewHazmat();
		},

		onCrossNavigate: function (oEvent) {
			var shellHash = oEvent.getSource().data("crossNavigate");

			if (!shellHash) {
				return;
			}
			this._setCookie("AppCancel", "ECC");
			this._setCookie("AppTrack", "ECC");
			var xnavservice = sap.ushell && sap.ushell.Container && sap.ushell.Container.getService && sap.ushell.Container.getService(
				"CrossApplicationNavigation");
			xnavservice.toExternal({
				target: {
					shellHash: shellHash
				}
			});
		},

		_setCookie: function (sName, sValue) {
			document.cookie = sName + "=" + sValue + ";path=/";
		},

		onPrepaidSelect: function (oEvent) {
			var bChecked = oEvent.getParameter("selected");
			this.getModel("local").setProperty("/basic/payment/ppaid_add", bChecked);
		},

		onOpenAdvancedPackingDialog: function () {
			this._refreshPackingData();
			this.oAdvancedPackingDialog = Utils.getFragment("", "packing.AdvancedPackingDialog", this);
			this.oAdvancedPackingDialog.open();

			var oView = this.getView();
			// First packing scenario - Pack by Material
			this.oContentTable = this.byId(oView.createId(sap.ui.core.Fragment.createId("advancedModeMaterial", "tableItem")));
			this.oContentTable.removeSelections();
			this.oHUTable = this.byId(oView.createId(sap.ui.core.Fragment.createId("advancedModeMaterial", "tableHU")));
			this.oHUTable.removeSelections();
			// Second packing scenario - Pack by HU
			this.oHULeftTable = this.byId(oView.createId(sap.ui.core.Fragment.createId("advancedModeHU", "tableLeftHU")));
			this.oHULeftTable.removeSelections();
			this.oHURightTable = this.byId(oView.createId(sap.ui.core.Fragment.createId("advancedModeHU", "tableRightHU")));
			this.oHURightTable.removeSelections();
		},

		onCloseAdvancedPackingDialog: function () {
			this.oAdvancedPackingDialog.close();
		},

		/*
		 * Fedex ETD Upload handler
		 * Last Modified: Tim
		 * Last Changed: 30.11.2021
		 */
		onSelectIconTabETDUpload: function (oEvent) {
			UploadUtils._buildEmptyUploadData(this);
		},

		onETDImagePress: function (oEvent) {
			var oETDItem = oEvent.getParameter("listItem");
			var oETDItemData = oETDItem.getBindingContext("local").getObject();
			var sImageId = oETDItemData.ImageID;
			this._loadImageData(sImageId);
		},

		onOpenETDUploadDialog: function () {
			/*
			 *Build and get data before open dialog
			 */
			UploadUtils.setETDInitData(this);
			var oThis = this;
			var oETDImage = this._loadETDImages("");
			oETDImage.done(function (data) {
				var imageData = {
					ImageID: "",
					Usage: "",
					UploadType: ""
				};
				if (data && data.length > 0) {
					imageData.ImageID = data[0].imageId;
					imageData.Usage = data[0].usageId;
					imageData.UploadType = "";
					UploadUtils._setImageUploadData(oThis, imageData);
				} else {
					UploadUtils._buildInitEmptyUploadData(oThis, "IMAGE_1");
				}

				oThis.ETDUploadDialog = Utils.getFragment("", "ETDUploadDialog", oThis);
				oThis.ETDUploadDialog.open();
			}.bind(this));

		},
		_loadETDImages: function (imageId) {
			var oThis = this;
			var sPath = "/xSERPERPxCDS_ETD_IMG";
			var filters = [];
			if (imageId && imageId !== "") {
				filters = [
					new Filter("imageId", "EQ", imageId)
				];
			}
			var oETDImageLoaded = $.Deferred();
			this.showBusy();
			this.getModel().read(sPath, {
				filters: filters,
				success: function (oData) {
					if (oData && oData.results.length > 0) {
						var aETDImageIds = [];
						oData.results.forEach(function (data) {
							var imageData = {
								ImageID: data.imageId,
								Usage: data.usageId,
								UploadType: ""
							};
							aETDImageIds.push(imageData);
						});

						//Assign data
						for (var i = 1; i <= 5; i++) {
							var uniq = "IMAGE_" + i;
							var exist = Utils._getExistItemsArray(aETDImageIds, "ImageID", uniq);
							if (exist.length === 0) {
								var imageData = {
									ImageID: uniq,
									Usage: "",
									UploadType: ""
								};
								aETDImageIds.push(imageData);
							}

						}
						oThis.getModel("local").setProperty("/ETDImageIds", aETDImageIds);
						if (imageId === "") {
							oThis.getModel("local").setProperty("/ETDImageIdList", aETDImageIds);
						}
					}
					oETDImageLoaded.resolve(oData.results);
					oThis.hideBusy();
				},
				error: function (oError) {
					console.log('Get ETD Images Err: ', oError); //eslint-disable-line
					oETDImageLoaded.resolve([]);
					oThis.hideBusy();
				}.bind(this)
			});
			return oETDImageLoaded.promise();

		},
		_loadImageData: function (sImageId) {
			var oThis = this;
			var oETDImage = this._loadETDImages(sImageId);
			oETDImage.done(function (data) {
				var imageData = {
					ImageID: sImageId,
					Usage: "",
					UploadType: ""
				};
				if (data && data.length > 0) {
					imageData.Usage = data[0].usageId;
				}
				UploadUtils._setImageUploadData(oThis, imageData);
			}.bind(this));
		},
		onETDImageImageIDChange: function (oEvent) {
			var oImageComp = oEvent.getSource();
			var sImageId = oImageComp.getSelectedKey();
			this._loadImageData(sImageId);

		},
		onCloseETDUploadDialog: function () {
			UploadUtils._buildEmptyUploadData(this);
			this.ETDUploadDialog.close();
		},

		handleChangeImage: function (oEvent) {
			var index = 0; //Always upload 1 file
			this.oImage = oEvent.getParameters().files[index];
			if (this.oImage) {
				UploadUtils._handleUploadChange(this.oImage, this);
			} else if (this.oImage === undefined) {
				this.oImage = {};
				this.oUploadFile = {};
			}
		},

		handleChangeDoc: function (oEvent) {
			var index = 0; //Always upload 1 file
			this.oDoc = oEvent.getParameters().files[index];
			if (this.oDoc) {
				UploadUtils._handleUploadChange(this.oDoc, this);
			} else if (this.oDoc === undefined) {
				this.oDoc = {};
				this.oUploadFile = {};
			}
		},

		onSubmitDataETDUploadDialog: function () {
			this.showBusy();
			var oSubmitData = this.getModel("local").getProperty("/ETDUpload");
			var oValid;
			var sSelectedETDUploadTab = this.byId("idIconTabBarFiori2").getSelectedKey();

			//Process Upload Images
			if (sSelectedETDUploadTab === "Image") {
				oValid = UploadUtils._validateUploadImageData(oSubmitData, this);
				if (oValid.isValid === false) {
					MessageBox.error(oValid.message);
					this.hideBusy();
					return;
				}

				//upload image
				var oImage = UploadUtils._buildDataForUpload(this.oUploadFile);
				UploadUtils._uploadImage(oImage, this);
			} else {
				oValid = UploadUtils._validateUploadDocData(oSubmitData, this);
				if (oValid.isValid === false) {
					MessageBox.error(oValid.message);
					this.hideBusy();
					return;
				}

				//Upload document
				var oDoc = UploadUtils._buildDataForUpload(this.oUploadFile);
				UploadUtils._uploadDocument(oDoc, this);
			}

		},

		onCheckSizeImageUpload: function (oEvent) {
			var sFileSize = oEvent.getParameters().fileSize;
			var maxSize = 2; // The masSize meaning 2MB
			if (sFileSize > maxSize) {
				MessageBox.warning(this.oBundle.getText("etdUploadImageSizePlease"));
			}
		},

		onTypeMissMatchImage: function (oEvent) {
			var aFileTypes = ["jpg", "png"];
			var sFileType = oEvent.getParameters().fileType;
			if (aFileTypes.indexOf(sFileType) === -1) {
				MessageBox.warning(this.oBundle.getText("etdUploadImageFileType"));
			}
		},

		onTypeMissMatchDoc: function (oEvent) {
			var aFileTypes = ["doc", "docx", "pdf", "xls", "xlsx"];
			var sFileType = oEvent.getParameters().fileType;
			if (aFileTypes.indexOf(sFileType) === -1) {
				MessageBox.warning(this.oBundle.getText("etdUploadDocFileType"));
			}
		},
		//end Fedex ETD Upload handler

		onAdvancedPackingPageChanged: function (oEvent) {
			var sSelectedPage = oEvent.getParameter("newActivePageId");
			if (oEvent.getSource().getPages()[0].getId() === sSelectedPage) {
				this.byId("dialogAdvancedPacking").setTitle(this.oBundle.getText("advancedPackingByMaterial"));
				this._refreshPackingData();
			} else {
				this.byId("dialogAdvancedPacking").setTitle(this.oBundle.getText("advancedPackingByHU"));
				// Update editable fields in the backend
				var oDeferred = $.Deferred();
				oDeferred = this._updateHUAdvancedPackingDimensions(false);
				$.when(oDeferred).done(function () {
					this._buildITHU();
					oDeferred = $.Deferred();
				}.bind(this));
			}
		},

		onAdvancedPackingDialogBeforeClose: function (oEvent) {
			this.oContentTable = this.byId("tableItem");
			this.oHUTable = this.byId("tableHU");
			this.oHULeftTable = null;
			this.oHURightTable = null;
			this.byId("AdvancePackingCarousel").setActivePage(this.byId("AdvancePackingCarousel").getPages()[0].getId());
		},

		onFilterAdvanceHUType: function (oEvent) {
			this._refreshPackingData();
		},

		onPackHuToHU: function (oEvent) {
			var aSelectedLeftHUs = this.oHULeftTable.getSelectedItems();
			if (aSelectedLeftHUs.length === 0) {
				MessageBox.error(this.oBundle.getText("SelectAtLeastOneLeftHUPack"));
				return;
			}
			var aSelectedRightHUs = this.oHURightTable.getSelectedItems();
			if (aSelectedRightHUs.length !== 1) {
				MessageBox.error(this.oBundle.getText("SelectOneRightHUPack"));
				return;
			}

			this._packHUToHU();
		},

		onUnpackHUFromHU: function (oEvent) {
			var aSelectedRightHUs = this.oHURightTable.getSelectedItems();
			if (aSelectedRightHUs.length === 0) {
				MessageBox.error(this.oBundle.getText("SelectHUUnPack"));
				return;
			}
			MessageBox.confirm(this.oBundle.getText("confirmUnPackHUMessage"), {
				title: this.oBundle.getText("ConfirmUnPacking"),
				actions: [sap.m.MessageBox.Action.YES, sap.m.MessageBox.Action.NO],
				initialFocus: sap.m.MessageBox.Action.YES,
				onClose: function (oAction) {
					if (oAction === MessageBox.Action.YES) {
						this._unpackHUFromHU();
					}
				}.bind(this)
			});
		},

		onShowPackingOverview: function (oEvent) {
			var sType = oEvent.getSource().getMetadata().getName();
			if (sType === "sap.m.Button") {
				this._showPackingOverview();
			} else {
				this._showPackingOverview(oEvent.getSource().getText());
			}
		},

		onChangeHUHeaderEditableFields: function (oEvent) {
			var oObject = oEvent.getSource().getBindingContext("local").getObject();
			var aFreightUnits = this.getModel("local").getProperty("/Freightunits");
			for (var i = 0; i < aFreightUnits.length; i++) {
				if (oObject.freightunitkey === aFreightUnits[i].freightunitkey) {
					aFreightUnits[i].weight = oObject.weight;
					aFreightUnits[i].weight_unit = oObject.weight_unit;
					aFreightUnits[i]["length"] = oObject["length"];
					aFreightUnits[i].width = oObject.width;
					aFreightUnits[i].height = oObject.height;
					aFreightUnits[i].dims_unit = oObject.dims_unit;
					this.getModel("local").setProperty("/FreightUnits", aFreightUnits);
					break;
				}
			}

			// Update editable fields in the backend
			var oDeferred = $.Deferred();
			oDeferred = this._updateHUAdvancedPackingDimensions(true);
			$.when(oDeferred).done(function () {
				this.hideBusy();
				oDeferred = $.Deferred();
			}.bind(this));
		},

		onClosePackingOverviewDialog: function () {
			this.oPackingOverviewDialog.close();
		},

		onBatteryDetailPress: function () {
			this.oBattDetailDlg = Utils.getFragment("", "BatteryDetailDialog", this);
			this.oBattDetailDlg.open();
		},

		onCloseBatteryDetailDialog: function () {
			var sCarrier = this.getModel("local").getProperty("/basic/carrier_data/carrier").toLowerCase();
			var sPath = "/basic/carrier_data/carrier_options/" + sCarrier + "/opt02/";

			this.getModel("local").setProperty(sPath + "batt_material", this.byId("idBattMat").getSelectedKey());
			this.getModel("local").setProperty(sPath + "batt_packing", this.byId("idBattPack").getSelectedKey());
			this.getModel("local").setProperty(sPath + "batt_regtype", this.byId("idBattReg").getSelectedKey());

			this.oBattDetailDlg.close();
		},

		onChangeFedExGrdHoldLocationDetailCheckBox: function (oEvent) {
			var bCheck = oEvent.getSource().getSelected();
			if (bCheck) {
				this.byId("fedexGrdHoldLocateButton").setEnabled(true);
			} else {
				this.byId("fedexGrdHoldLocateButton").setEnabled(false);
			}
		},

		onChangeFedExHoldLocationDetailCheckBox: function (oEvent) {
			var bCheck = oEvent.getSource().getSelected();
			if (bCheck) {
				this.byId("fedexHoldLocateButton").setEnabled(true);
			} else {
				this.byId("fedexHoldLocateButton").setEnabled(false);
			}
		},

		onShowFDXGHoldLocationDetail: function () {
			var oDeferred = $.Deferred();
			if (!this.oDialogFDXGHoldLocationDetail) {
				this.oDialogFDXGHoldLocationDetail = sap.ui.xmlfragment(
					"com.erpis.shiperp.parcel.hr7.fragment.carrier.FedExGroundHoldAtLocationDetailDialog",
					this);
				this.getView().addDependent(this.oDialogFDXGHoldLocationDetail);
			}
			if (this.oDialogFDXGHoldLocationDetail.open()) {
				oDeferred.resolve();
			}
			$.when(oDeferred).done(function (oEvent) {
				var oHoldAtLocationStateFDXG = sap.ui.getCore().byId("slHoldAtLocationStateFDXG");
				oHoldAtLocationStateFDXG.getBinding("items").filter(new Filter("Country", "EQ", this.getModel("local").getProperty(
					"/basic/carrier_data/carrier_options/fdxg/opt02/holdctry")));
				oHoldAtLocationStateFDXG.getBinding("items").attachDataReceived(function () {
					oHoldAtLocationStateFDXG.setSelectedKey(this.getModel("local").getProperty(
						"/basic/carrier_data/carrier_options/fdxg/opt02/holdstate"));
				}.bind(this), this);
			}.bind(this));

		},

		onShowFDXEHoldLocationDetail: function () {
			var oDeferred = $.Deferred();
			if (!this.oDialogFDXEHoldLocationDetail) {
				this.oDialogFDXEHoldLocationDetail = sap.ui.xmlfragment(
					"com.erpis.shiperp.parcel.hr7.fragment.carrier.FedExHoldAtLocationDetailDialog",
					this);
				this.getView().addDependent(this.oDialogFDXEHoldLocationDetail);
			}
			if (this.oDialogFDXEHoldLocationDetail.open()) {
				oDeferred.resolve();
			}
			$.when(oDeferred).done(function (oEvent) {
				var oHoldAtLocationStateFDXE = sap.ui.getCore().byId("slHoldAtLocationStateFDXE");
				oHoldAtLocationStateFDXE.getBinding("items").filter(new Filter("Country", "EQ", this.getModel("local").getProperty(
					"/basic/carrier_data/carrier_options/fdxe/opt02/holdctry")));
				oHoldAtLocationStateFDXE.getBinding("items").attachDataReceived(function () {
					oHoldAtLocationStateFDXE.setSelectedKey(this.getModel("local").getProperty(
						"/basic/carrier_data/carrier_options/fdxe/opt02/holdstate"));
				}.bind(this), this);
			}.bind(this));
		},

		onHoldFDXGLocationDetailClose: function () {
			this.oDialogFDXGHoldLocationDetail.close();
		},

		onHoldFDXELocationDetailClose: function () {
			this.oDialogFDXEHoldLocationDetail.close();
		},

		onShowFDXGCODRecipientDetail: function () {
			var oDeferred = $.Deferred();
			if (!this.oDialogCODFDXGRecipientDetail) {
				this.oDialogCODFDXGRecipientDetail = sap.ui.xmlfragment(
					"com.erpis.shiperp.parcel.hr7.fragment.carrier.FedExGroundCODRecipientDetailDialog",
					this);
				this.getView().addDependent(this.oDialogCODFDXGRecipientDetail);
			}
			if (this.oDialogCODFDXGRecipientDetail.open()) {
				oDeferred.resolve();
			}
			$.when(oDeferred).done(function (oEvent) {
				var oCODRecipientFDXG = sap.ui.getCore().byId("slCODRecipientFDXG");
				oCODRecipientFDXG.getBinding("items").filter(new Filter("Country", "EQ", this.getModel("local").getProperty(
					"/basic/partners/shipfrom/address/country")));
				oCODRecipientFDXG.getBinding("items").attachDataReceived(function () {
					oCODRecipientFDXG.setSelectedKey(this.getModel("local").getProperty(
						"/basic/partners/shipfrom/address/state"));
				}.bind(this), this);
			}.bind(this));

		},

		onShowFDXECODRecipientDetail: function () {
			var oDeferred = $.Deferred();
			if (!this.oDialogCODFDXERecipientDetail) {
				this.oDialogCODFDXERecipientDetail = sap.ui.xmlfragment(
					"com.erpis.shiperp.parcel.hr7.fragment.carrier.FedExCODRecipientDetailDialog",
					this);
				this.getView().addDependent(this.oDialogCODFDXERecipientDetail);
			}
			if (this.oDialogCODFDXERecipientDetail.open()) {
				oDeferred.resolve();
			}
			$.when(oDeferred).done(function (oEvent) {
				var oCODRecipientFDXE = sap.ui.getCore().byId("slCODRecipientFDXE");
				oCODRecipientFDXE.getBinding("items").filter(new Filter("Country", "EQ", this.getModel("local").getProperty(
					"/basic/partners/shipfrom/address/country")));
				oCODRecipientFDXE.getBinding("items").attachDataReceived(function () {
					oCODRecipientFDXE.setSelectedKey(this.getModel("local").getProperty(
						"/basic/partners/shipfrom/address/state"));
				}.bind(this), this);
			}.bind(this));
		},

		onCODFDXGRecipientDetailClose: function () {
			this.oDialogCODFDXGRecipientDetail.close();
		},

		onCODFDXERecipientDetailClose: function () {
			this.oDialogCODFDXERecipientDetail.close();
		},
		/**
		 * Handle more option from ItemsPacking.fragment.xml
		 * */
		onHandleItemsPackingMoreOption: function (oEvent) {
			var itemPath = oEvent.getSource().getBindingContextPath();
			if (itemPath) {
				var oFreightUnitItemRow = this.getModel("local").getProperty(itemPath);
				var oCarrierMoreOptionData = oFreightUnitItemRow.carrier_more_option;
				if (oCarrierMoreOptionData.results && oCarrierMoreOptionData.results.length > 0) {
					this._getPackageCarrierMoreOptions(oCarrierMoreOptionData, itemPath);
				} else {
					MessageBox.information(this.oBundle.getText("Nocarriermoreoptext"));
				}
			}

		},
		// onPressToShowTabUltimateConsignee: function (oEvent) {
		// 	var bCheck = oEvent.getParameters().selected;
		// 	if (bCheck) {
		// 		this.byId("iconTabCarrier").setVisible(true);
		// 		this.byId("iconTabCarrierSub").setTitle("Ultimate Consignee");
		// 	} else {
		// 		this.byId("iconTabCarrier").setVisible(false);
		// 		// this.byId("iconTabCarrierSub").setTitle(this.getModel("local").getProperty("/basic/carrier_data/CarrierName"));
		// 	}
		// },

		/* =========================================================== */
		/* internal methods                                            */
		/* =========================================================== */
		// Reset whole screen data
		_resetData: function () {
			this.byId("txtId").removeAllTokens();
			this.byId("btnHTS").setVisible(false);
			// // Enable inputs fields
			this.byId("txtId").setEditable(true);
			this.getModel("local").setData({});

			this.byId("ObjectPageLayout").setShowHeaderContent(false);
			this.byId("ObjectPageLayout").setPreserveHeaderStateOnScroll(false);
			this.byId("iconTabCarrier").setVisible(false);
			this.byId("iconTabInternational").setVisible(false);
			this.byId("iconTabImporter").setVisible(false);

			this.hideBusy();
		},

		enableEditFreightUnits: function (bEditable) {
			var aSelectedHUs = this.oHUTable.getItems();
			for (var i = 0; i < aSelectedHUs.length; i++) {
				this.enableEditFreighUnit(aSelectedHUs[i], bEditable);
			}
		},

		enableEditFreighUnit: function (oTableItem, bEditable) {
			// Make column weight editable
			oTableItem.getCells()[3].getItems()[0].setVisible(bEditable);
			oTableItem.getCells()[3].getItems()[1].setVisible(!bEditable);
			// Make column length editable
			oTableItem.getCells()[5].getItems()[0].setVisible(bEditable);
			oTableItem.getCells()[5].getItems()[1].setVisible(!bEditable);
			// Make column width editable
			oTableItem.getCells()[6].getItems()[0].setVisible(bEditable);
			oTableItem.getCells()[6].getItems()[1].setVisible(!bEditable);
			// Make column height editable
			oTableItem.getCells()[7].getItems()[0].setVisible(bEditable);
			oTableItem.getCells()[7].getItems()[1].setVisible(!bEditable);
			// UoM
			oTableItem.getCells()[8].getItems()[0].setVisible(false);
			oTableItem.getCells()[8].getItems()[1].setVisible(true);
		},

		enableEditFreightUnitsforExternalScale: function (bEditable) {
			var aSelectedHUs = this.oHUTable.getItems();
			for (var i = 0; i < aSelectedHUs.length; i++) {
				this.enableEditFreighUnitforExternalScale(aSelectedHUs[i], bEditable);
			}
		},

		enableEditFreighUnitforExternalScale: function (oTableItem, bEditable) {
			// Make column weight editable
			oTableItem.getCells()[3].getItems()[0].setVisible(false);
			oTableItem.getCells()[3].getItems()[1].setVisible(true);
			// Make column length editable
			oTableItem.getCells()[5].getItems()[0].setVisible(bEditable);
			oTableItem.getCells()[5].getItems()[1].setVisible(!bEditable);
			// Make column width editable
			oTableItem.getCells()[6].getItems()[0].setVisible(bEditable);
			oTableItem.getCells()[6].getItems()[1].setVisible(!bEditable);
			// Make column height editable
			oTableItem.getCells()[7].getItems()[0].setVisible(bEditable);
			oTableItem.getCells()[7].getItems()[1].setVisible(!bEditable);
			// Make column UoM editable
			oTableItem.getCells()[8].getItems()[0].setVisible(bEditable);
			oTableItem.getCells()[8].getItems()[1].setVisible(!bEditable);
			// edit button
			oTableItem.getCells()[9].getItems()[0].setPressed(bEditable);
		},

		getFirstCellEdit: function (oNextItemSelected, iNextCell) {
			if (iNextCell === oNextItemSelected.getCells().length) {
				return null;
			}
			if (typeof (oNextItemSelected.getCells()[iNextCell].getItems) === "undefined") {
				return this.getFirstCellEdit(oNextItemSelected, iNextCell + 1);
			}
			var oNextCell = oNextItemSelected.getCells()[iNextCell].getItems()[0];
			if (oNextCell.getMetadata().getName().indexOf("Input") >= 0 && oNextCell.getVisible() && oNextCell.getEditable()) {
				return oNextCell;
			}
			return this.getFirstCellEdit(oNextItemSelected, iNextCell + 1);
		},

		_getRateAnalysis: function () {
			var oRequestData = this._generateGetFreightCostAnalysisUsecase();
			this.showBusy();
			this.getModel().create("/ShipmentQuerySet", oRequestData, {
				success: function (oData) {
					try {
						this.getModel("local").setProperty("/RateAnalysis", oData.CarrierRateAnalysisSet.results);
					} catch (exc) {
						this.getModel("local").setProperty("/RateAnalysis", []);
						this.oLogger.info("No Carrier Rate Analysis");
					}

					if (!this.oRateAnalysisDialog) {
						this.oRateAnalysisDialog = sap.ui.xmlfragment("com.erpis.shiperp.parcel.hr7.fragment.RateAnalysisDialog", this);
						this.getView().addDependent(this.oRateAnalysisDialog);
					}
					this.oRateAnalysisDialog.open();
					this.hideBusy();
				}.bind(this),
				error: function (oError) {
					this._handleODataError(oError);
					this.hideBusy();
				}.bind(this)
			});
		},

		_generateGetFreightCostAnalysisUsecase: function () {
			var oData = {
				shipmentid: "",
				inputids: (this.sInputIDs) ? this.sInputIDs : "",
				inputtype: (this.sInputType) ? this.sInputType : "",
				profile: (this.sProfile) ? this.sProfile : "",
				shippingstation: (this.sStation) ? this.sStation : "",
				action: "GetRateAnalysis",
				CarrierRates: [sap.ui.getCore().byId("tableRates").getSelectedItem().getBindingContext("local").getObject()],
				CarrierRateAnalysisSet: this.getModel("local").getProperty("/OrgCarrierRateAnalysis")
			};
			return oData;
		},

		_getFreightCost: function (sWhichAction) {
			var oRequestData = this._generateGetFreightCostUsecase(sWhichAction);
			this.showBusy();
			this.getModel().create("/ShipmentQuerySet", oRequestData, {
				success: function (oData) {
					try {
						this.getModel("local").setProperty("/Rates", oData.CarrierRates.results);
					} catch (exc) {
						this.getModel("local").setProperty("/Rates", []);
						this.oLogger.info("No Carrier Rates");
					}
					try {
						this.getModel("local").setProperty("/RateErrors", oData.CarrierRateErrors.results);
					} catch (exc) {
						this.getModel("local").setProperty("/RateErrors", []);
						this.oLogger.info("No Carrier Rates");
					}
					try {
						this.getModel("local").setProperty("/RateDetails", oData.CarrierRateDetailSet.results);
					} catch (exc) {
						this.getModel("local").setProperty("/RateDetails", []);
						this.oLogger.info("No Carrier Rates");
					}
					try {
						this.getModel("local").setProperty("/RatePricings", oData.CarrierRatePricingSet.results);
					} catch (exc) {
						this.getModel("local").setProperty("/RatePricings", []);
						this.oLogger.info("No Carrier Rates");
					}
					try {
						this.getModel("local").setProperty("/OrgCarrierRateAnalysis", oData.CarrierRateAnalysisSet.results);
					} catch (exc) {
						this.getModel("local").setProperty("/OrgCarrierRateAnalysis", []);
						this.oLogger.info("No Carrier Rate Analysis");
					}
					if (oData.RateFreightUnits) {
						this.getModel("local").setProperty("/RateFreightUnits", oData.RateFreightUnits.results);
					} else {
						this.getModel("local").setProperty("/RateFreightUnits", []);
					}
					if (!this.oRateDialog) {
						this.oRateDialog = sap.ui.xmlfragment("com.erpis.shiperp.parcel.hr7.fragment.RatesDialog", this);
						this.getView().addDependent(this.oRateDialog);
					}
					this.oRateDialog.open();
					this.hideBusy();
				}.bind(this),
				error: function (oError) {
					this._handleODataError(oError);
					this.hideBusy();
				}.bind(this)
			});
		},

		_generateGetFreightCostUsecase: function (sWhichAction) {
			var oBasic = this.getModel("local").getProperty("/basic")
			var sActionName = "GetSingleFreightCost";
			if (sWhichAction === "S") {
				sActionName = "GetSingleFreightCost";
			} else if (sWhichAction === "R") {
				sActionName = "GetShopFreightCost";
			} else if (sWhichAction === "O") {
				sActionName = "GetOptimizationFreightCost";
			} else {
				sActionName = "GetSingleFreightCost";
			}
			//updated 20/10/2021 by Tim for remove prefix
			this.handleCarrierMoreOptionDataBeforeGenerate();
			var aInternational = this.getModel("local").getProperty("/Internationaloptions");
			if (aInternational) {
				aInternational.forEach(function (item) {
					if (typeof item.FieldValue2 !== "string") {
						item.FieldValue2 = JSON.stringify(item.FieldValue2);
					}
					if (typeof item.Searchhelp !== "string") {
						item.Searchhelp = JSON.stringify(item.Searchhelp);
					}
					delete item.__metadata;
				})
			}
			var aFreightunits = this._getSelectedFUs(oBasic);
			aFreightunits.forEach(function (items) {
				items.FreightunitHazmat.results.forEach(function (itemhazmat) {
					if (itemhazmat.freightunit_hazmatopt.results) {
						itemhazmat.freightunit_hazmatopt.results.forEach(function (obj) {
							if (typeof obj.FieldValue2 !== "string") {
								obj.FieldValue2 = JSON.stringify(obj.FieldValue2);
								obj.Searchhelp = JSON.stringify(obj.FieldValue2);
							}
						});
					}
				});
			});
			var oData = {
				shipmentid: "",
				inputids: (this.sInputIDs) ? this.sInputIDs : "",
				inputtype: (this.sInputType) ? this.sInputType : "",
				profile: (this.sProfile) ? this.sProfile : "",
				shippingstation: (this.sStation) ? this.sStation : "",
				action: sActionName,
				basic: oBasic,
				Freightunits: aFreightunits,
				HTS: this.getModel("local").getProperty("/HTS"),
				References: this.getModel("local").getProperty("/References"),
				CarrierRates: [],
				CarrierRateDetailSet: [],
				CarrierRatePricingSet: [],
				CarrierRateErrors: [],
				CarrierRateAnalysisSet: [],
				RateFreightUnits: [],
				International: (aInternational) ? aInternational : []
			};
			return oData;
		},

		_getSelectedFUs: function (oBasic) {
			var aFreightUnits = [];
			var aSelectedHus = this.oHUTable.getSelectedItems();
			var aMPS = oBasic.carrier_data.mps;
			// check MPS
			if (aMPS.mps !== "") {
				// select all item
				aFreightUnits = this.getModel("local").getProperty("/Freightunits");
			} else if (aSelectedHus.length === 0) {
				// select all item
				aFreightUnits = this.getModel("local").getProperty("/Freightunits");
			} else {
				for (var i = 0; i < aSelectedHus.length; i++) {
					aFreightUnits.push(aSelectedHus[i].getBindingContext("local").getObject());
				}
			}
			return aFreightUnits;
		},

		_getContentAndHUTable: function (sWhichTable) {
			var oRequestData = this._generateGetContentHUUsecase(sWhichTable);
			this.getModel().create("/ShipmentQuerySet", oRequestData, {
				success: function (oData) {
					if (oData.Contents) {
						this.getModel("local").setProperty("/Contents", oData.Contents.results);
					} else {
						this.getModel("local").setProperty("/Contents", []);
					}
					if (oData.Freightunits) {
						for (var i = 0; i < oData.Freightunits.results.length; i++) {
							if (!oData.Freightunits.results[i].FreightunitItems) {
								oData.Freightunits.results[i].FreightunitItems = [];
							}
							if (!oData.Freightunits.results[i].FreightunitItems.results) {
								oData.Freightunits.results[i].FreightunitItems = [];
							}
							if (!oData.Freightunits.results[i].FreightunitHazmat) {
								oData.Freightunits.results[i].FreightunitHazmat = [];
							}
							if (!oData.Freightunits.results[i].FreightunitHazmat.results) {
								oData.Freightunits.results[i].FreightunitHazmat = [];
							}
						}
						this.getModel("local").setProperty("/Freightunits", oData.Freightunits.results);
					} else {
						this.getModel("local").setProperty("/Freightunits", []);
					}
					this.oContentTable.removeSelections();
					/**
					 * (-) dim code for removrSelected
					 * Modified by: Michael Ha
					 * Modified at: 31/08/2022
					 */
					// this.oHUTable.removeSelections();
					// select next HU item if execute successfully.
					this._selectNextItem();
					//Hooks in Standard Controller for making controller extension
					if (this.afterGetTwoTable) {
						this.afterGetTwoTable(oData);
					}

					//Axo 4770
					this._updateShippingAndCarrMoreOpt();
					this.hideBusy();
				}.bind(this),
				error: function (oError) {
					this._handleODataError(oError);
					this.hideBusy();
				}.bind(this)
			});
		},

		_generateGetContentHUUsecase: function (sWhichTable) {
			var sActionName = "GetContentAndHUTable";
			if (sWhichTable === "Content") {
				sActionName = "GetContentTable";
			} else if (sWhichTable === "HU") {
				sActionName = "GetHUTable";
			} else if (sWhichTable === "All") {
				sActionName = "GetContentAndHUTable";
			} else {
				sActionName = "GetContentAndHUTable";
			}
			var aFreightunits = [{
				FreightunitItems: [],
				FreightunitHazmat: [{
					freightunit_hazmatopt: [{
						value_list: []
					}]
				}],
				carrier_more_option: [{
					value_list: []
				}]
			}];

			if (this.getModel("local").getProperty("/Freightunits").length > 0) {
				aFreightunits = this.getModel("local").getProperty("/Freightunits");
			}
			var oData = {
				shipmentid: this.getModel("local").getProperty("/UseScale"),
				inputids: (this.sInputIDs) ? this.sInputIDs : "",
				inputtype: (this.sInputType) ? this.sInputType : "",
				profile: (this.sProfile) ? this.sProfile : "",
				shippingstation: (this.sStation) ? this.sStation : "",
				action: sActionName,
				basic: this.getModel("local").getProperty("/basic"),
				Freightunits: aFreightunits,
				Contents: [],
				HTS: this.getModel("local").getProperty("/HTS"),
				References: this.getModel("local").getProperty("/References"),
				CarrierRates: []
			};
			return oData;
		},

		_changeCarrier: function (sServiceID) {
			// Update Carrier name and service id
			var sCarrierName = this.byId("cbCarrier").getSelectedItem().getText();
			this.getModel("local").setProperty("/basic/carrier_data/CarrierName", sCarrierName);
			this.getModel("local").setProperty("/basic/carrier_data/service", sServiceID);
			var oRequestData = this._generateChangeCarrierUsecase();
			this.showBusy();
			this.getModel().create("/ShipmentQuerySet", oRequestData, {
				success: function (oData) {
					this.byId("selectService").setSelectedKey("");
					if (oData.carrier_more_option && oData.carrier_more_option.results) {
						this.getModel("local").setProperty("/ShipmentCarrierOptions", oData.carrier_more_option.results);
					}
					if (oData.Freightunits) {
						this.getModel("local").setProperty("/Freightunits", oData.Freightunits.results);
					}
					if (oData.basic) {
						oData.basic.hu_object.Object = this.sObject;
						oData.basic.hu_object.ObjectKey = this.sObjectKey;
						this.getModel("local").setProperty("/basic", oData.basic);
					}
					if (oData.References) {
						this.getModel("local").setProperty("/References", oData.References.results);
					} else {
						this.getModel("local").setProperty("/References", []);
					}

					if (oData.International.results.length > 0) {
						this.getModel("local").setProperty("/Internationaloptions", oData.International.results);
						this._displayShipmentInternationOprionTab();
					}

					//Commend out by Tim 9/9/2021
					/*
					if (oData.basic.carrier_data.carrier === "FDXE") {
						this._bindEmptyPickupReadyTimeFDXE();
					} else if (oData.basic.carrier_data.carrier === "FDXG") {
						this._bindEmptyPickupReadyTimeFDXG();
					}*/

					this._displayTabs();
					//Axo 4813
					this._updateShippingAndCarrMoreOpt();

					// Filter all the available dropdowns
					this._filterAllDropdowns();
					// display message strip header.
					this._displayMessageStripHeader();
					this._updateCarrier();
					// used to reupdate service id when selecting rate entry from the rate dialog
					if (this.sService !== "") {
						this.getModel("local").setProperty("/basic/carrier_data/service", this.sService);
						this.sService = "";
					}
					this.getModel("local").setProperty("/basic/carrier_data/service", oData.basic.carrier_data.service);
					this.hideBusy();
				}.bind(this),
				error: function (oError) {
					this._handleODataError(oError);
					this.hideBusy();
				}.bind(this)
			});
		},

		_updateCarrier: function () {
			var oDeferred = $.Deferred();
			oDeferred = this._updateHUAdvancedPackingDimensions(false);
			$.when(oDeferred).done(function () {
				var oRequestData = this._generatePackMaterialUsecase();
				this.getModel().create("/ShipmentQuerySet", oRequestData, {
					success: function () {
						this._getContentAndHUTable("All");
					}.bind(this),
					error: function (oError) {
						this._handleODataError(oError);
						this.hideBusy();
					}.bind(this)
				});
				oDeferred = $.Deferred();
			}.bind(this));
		},

		_generateChangeCarrierUsecase: function () {
			var aFreUnits = this.getModel("local").getProperty("/Freightunits");
			var aFreightunits = this.ConvertstringtoString(aFreUnits);
			var aShipmentCarrierOptions = this.getModel("local").getProperty("/ShipmentCarrierOptions");
			aShipmentCarrierOptions.forEach(function (obj) {
				if (typeof obj.FieldValue2 !== "string") {
					obj.FieldValue2 = JSON.stringify(obj.FieldValue2);
					obj.Searchhelp = JSON.stringify(obj.FieldValue2);
				}
			});
			var oData = {
				shipmentid: "",
				inputids: (this.sInputIDs) ? this.sInputIDs : "",
				inputtype: (this.sInputType) ? this.sInputType : "",
				profile: (this.sProfile) ? this.sProfile : "",
				shippingstation: (this.sStation) ? this.sStation : "",
				action: "ChangeCarrier",
				basic: this.getModel("local").getProperty("/basic"),
				carrier_more_option: aShipmentCarrierOptions,
				References: this.getModel("local").getProperty("/References"),
				Freightunits: aFreightunits, //added on 10/8/2021 by Tim to update carrier more option data
				International: [{
					value_list: []
				}]
			};
			return oData;
		},

		_changeReturnService: function () {
			var oRequestData = this._generateChangeReturnServiceUsecase();
			this.showBusy();
			this.getModel().create("/ShipmentQuerySet", oRequestData, {
				success: function (oData) {
					if (oData.basic.partners) {
						this.getModel("local").setProperty("/basic/partners/shipfrom/address", oData.basic.partners.shipfrom.address);
						this.getModel("local").setProperty("/basic/partners/shipto/address", oData.basic.partners.shipto.address);
						this.getModel("local").setProperty("/basic/shipment_flags/addr_switch", oData.basic.shipment_flags.addr_switch);
					}
					this._filterAllDropdowns();
					this.hideBusy();
				}.bind(this),
				error: function (oError) {
					this._handleODataError(oError);
					this.hideBusy();
				}.bind(this)
			});
		},

		_generateChangeReturnServiceUsecase: function () {
			var oData = {
				shipmentid: "",
				inputids: (this.sInputIDs) ? this.sInputIDs : "",
				inputtype: (this.sInputType) ? this.sInputType : "",
				profile: (this.sProfile) ? this.sProfile : "",
				shippingstation: (this.sStation) ? this.sStation : "",
				action: "ChangeReturnService",
				basic: this.getModel("local").getProperty("/basic"),
				carrier_more_option: this.getModel("local").getProperty("/ShipmentCarrierOptions"),
				References: this.getModel("local").getProperty("/References")
			};
			return oData;
		},

		_createHU: function () {
			if (sap.ui.getCore().byId("txtPackMat").getValue() === "") {
				sap.ui.getCore().byId("txtPackMat").setValueState("Error");
				sap.ui.getCore().byId("txtPackMat").setValueStateText(this.oBundle.getText("EnterPackMat"));
				return;
			} else {
				sap.ui.getCore().byId("txtPackMat").setValueState("None");
			}
			if (sap.ui.getCore().byId("txtHUNo").getValue() === "") {
				sap.ui.getCore().byId("txtHUNo").setValue("1");
			}

			this.showBusy();
			this.getModel().callFunction("/CreateHU", {
				urlParameters: {
					HuNo: sap.ui.getCore().byId("txtHUNo").getValue(),
					Object: this.sObject,
					ObjectKey: this.sObjectKey,
					PackagingMaterial: sap.ui.getCore().byId("txtPackMat").getValue(),
					WeightUnit: this.getModel("local").getProperty("/basic/unit/weight_unit")
				},
				success: function () {
					this._refreshPackingData();
					MessageToast.show(this.oBundle.getText("CreateHUSuccess"));
					this.oDialogNewHU.close();
				}.bind(this),
				error: function (oError) {
					this._handleODataError(oError);
					this.oDialogNewHU.close();
					this.hideBusy();
				}.bind(this)
			});
		},

		_deleteHUs: function (bAll) {
			var oRequestData = this._generateDeleteHUUsecase(bAll);
			if (oRequestData.Freightunits.length === 0 && oRequestData.FreightunitHeaders.length === 0) {
				MessageToast.show(this.oBundle.getText("noHUstodelete"));
				return;
			}
			this.showBusy();
			this.getModel().create("/ShipmentQuerySet", oRequestData, {
				success: function () {
					if (bAll) {
						this._refreshPackingData(true);
					} else {
						this._refreshPackingData();
					}
					MessageToast.show(this.oBundle.getText("DeleteHUSuccess"));
				}.bind(this),
				error: function (oError) {
					this._handleODataError(oError);
					this.hideBusy();
				}.bind(this)
			});
		},

		_generateDeleteHUUsecase: function (bAll) {
			var aSelectedHUs = [];
			var oTable;

			// Get the selected HUs depending on the Packing scenario
			if (this._getPackingScenario() === "01") { // Main Screen Scenario
				oTable = this.oHUTable;
			} else if (this._getPackingScenario() === "02") { // Pack by Material Dialog
				oTable = this.oHUTable;
			} else if (this._getPackingScenario() === "03") { // Pack by HU Dialog
				oTable = this.oHURightTable;
			} else { // Default
				oTable = this.oHUTable;
			}

			if (bAll) {
				aSelectedHUs = oTable.getItems();
			} else {
				aSelectedHUs = oTable.getSelectedItems();
			}

			var aFreightUnits = [];
			for (var i = 0; i < aSelectedHUs.length; i++) {
				var oItemData = aSelectedHUs[i].getBindingContext("local").getObject();
				if (oItemData.trackingnumber === "") {
					aFreightUnits.push(oItemData);
				}
			}
			var oData = {
				shipmentid: "",
				inputids: (this.sInputIDs) ? this.sInputIDs : "",
				inputtype: (this.sInputType) ? this.sInputType : "",
				profile: (this.sProfile) ? this.sProfile : "",
				shippingstation: (this.sStation) ? this.sStation : "",
				action: "DeleteHU",
				basic: this.getModel("local").getProperty("/basic"),
				Freightunits: (this._getPackingScenario() === "03") ? [] : aFreightUnits,
				FreightunitHeaders: (this._getPackingScenario() === "03") ? aFreightUnits : []
			};
			return oData;
		},

		_packPartial: function () {
			var oRequestData = this._generatePackPartialUsecase();
			this.showBusy();
			this.getModel().create("/ShipmentQuerySet", oRequestData, {
				success: function () {
					this._refreshPackingData(true);
					MessageToast.show(this.oBundle.getText("PackPartialSuccess"));
				}.bind(this),
				error: function (oError) {
					this._handleODataError(oError);
					this.hideBusy();
				}.bind(this)
			});
		},

		_generatePackPartialUsecase: function () {
			var aSelectedItems = this.oContentTable.getSelectedItems();
			var aContents = [];
			var sTargetHU = this.oHUTable.getSelectedItems()[0].getBindingContext("local").getObject().freightunitkey;
			for (var i = 0; i < aSelectedItems.length; i++) {
				aSelectedItems[i].getBindingContext("local").getObject().partialqty = aSelectedItems[i].getBindingContext("local").getObject().partialqty +
					"";
				aContents.push(aSelectedItems[i].getBindingContext("local").getObject());
			}
			var oData = {
				shipmentid: "",
				inputids: (this.sInputIDs) ? this.sInputIDs : "",
				inputtype: (this.sInputType) ? this.sInputType : "",
				profile: (this.sProfile) ? this.sProfile : "",
				shippingstation: (this.sStation) ? this.sStation : "",
				action: "PackPartial",
				targethu: sTargetHU,
				basic: this.getModel("local").getProperty("/basic"),
				Contents: aContents
			};
			return oData;
		},

		_packMaterial: function () {
			this.showBusy();
			var oDeferred = $.Deferred();
			oDeferred = this._updateHUAdvancedPackingDimensions(false);
			$.when(oDeferred).done(function () {
				var oRequestData = this._generatePackMaterialUsecase();
				this.getModel().create("/ShipmentQuerySet", oRequestData, {
					success: function () {
						this._refreshPackingData(true);
						MessageToast.show(this.oBundle.getText("PackMaterialSuccess"));
					}.bind(this),
					error: function (oError) {
						this._handleODataError(oError);
						this.hideBusy();
					}.bind(this)
				});
				oDeferred = $.Deferred();
			}.bind(this));
		},

		_generatePackMaterialUsecase: function () {
			var aSelectedItems = this.oContentTable.getSelectedItems();
			var aContents = [];
			var sTargetHU = this.oHUTable.getSelectedItems()[0].getBindingContext("local").getObject().freightunitkey;
			for (var i = 0; i < aSelectedItems.length; i++) {
				aSelectedItems[i].getBindingContext("local").getObject().partialqty = aSelectedItems[i].getBindingContext("local").getObject().partialqty +
					"";
				aContents.push(aSelectedItems[i].getBindingContext("local").getObject());
			}
			var oData = {
				shipmentid: "",
				inputids: (this.sInputIDs) ? this.sInputIDs : "",
				inputtype: (this.sInputType) ? this.sInputType : "",
				profile: (this.sProfile) ? this.sProfile : "",
				shippingstation: (this.sStation) ? this.sStation : "",
				action: "PackMaterial",
				targethu: sTargetHU,
				basic: this.getModel("local").getProperty("/basic"),
				Contents: aContents
			};
			return oData;
		},

		_unpack: function (aSelectedHUs) {
			this.showBusy();
			var oDeferred = $.Deferred();
			oDeferred = this._updateHUAdvancedPackingDimensions(false);
			$.when(oDeferred).done(function () {
				var oRequestData = this._generateUnpackUsecase();
				this.getModel().create("/ShipmentQuerySet", oRequestData, {
					success: function () {
						// Before refreshing the table, remove controller property that store hazmat temporary data
						for (var i = 0; i < aSelectedHUs.length; i++) {
							var sFreightunitKey = aSelectedHUs[i].getBindingContext("local").getObject().freightunitkey;
							delete this.mFreightUnitHazmatItems[sFreightunitKey];
						}
						this._refreshPackingData(true);
						MessageToast.show(this.oBundle.getText("UnpackSuccess"));
					}.bind(this),
					error: function (oError) {
						this._handleODataError(oError);
						this.hideBusy();
					}.bind(this)
				});
				oDeferred = $.Deferred();
			}.bind(this));
		},

		_generateUnpackUsecase: function () {
			var aSelectedHus = this.oHUTable.getSelectedItems();
			var aFreightUnits = [];
			for (var i = 0; i < aSelectedHus.length; i++) {
				aFreightUnits.push(aSelectedHus[i].getBindingContext("local").getObject());
			}
			var oData = {
				shipmentid: "",
				inputids: (this.sInputIDs) ? this.sInputIDs : "",
				inputtype: (this.sInputType) ? this.sInputType : "",
				profile: (this.sProfile) ? this.sProfile : "",
				shippingstation: (this.sStation) ? this.sStation : "",
				action: "UnpackHU",
				basic: this.getModel("local").getProperty("/basic"),
				Freightunits: aFreightUnits
			};
			return oData;
		},
		/**
		 * Execute Ship button
		 * */
		_execute: function (sActionName, iValue, aManualtrack, flag) {
			var oRequestData = this._generateExecuteUsecase(sActionName, iValue, aManualtrack, flag);
			var oHUTab = this.oHUTable;
			var sMps = this.getModel("local").getProperty("/basic/carrier_data/mps/mps");
			var sMpsType = this.getModel("local").getProperty("/basic/carrier_data/mps/mpstype");
			if (!(sMps === "X" && sMpsType === "02")) { // is single
				this.oSelectedHu = oHUTab.getSelectedItem();
			}
			this.showBusy();
			this.getModel().create("/ShipmentQuerySet", oRequestData, {
				success: function (oData, oResponse) {
					if (oData.Custom_Fields !== null) {
						if (oData.Custom_Fields) {
							if (oData.ReturnMessages.results.length > 0) {
								var aMsg = this._generateMessages(oData.ReturnMessages.results);
								this.getModel("local").setProperty("/aMessagesValidateShipment", aMsg);
							}
							if (!this.oShipmentAddrValid) {
								this.oShipmentAddrValid = sap.ui.xmlfragment("com.erpis.shiperp.parcel.hr7.fragment.ShipmentAddressValidation", this);
								this.getView().addDependent(this.oShipmentAddrValid);
							}
							this.oShipmentAddrValid.open();
							this.hideBusy();
							return;
						}
						if (oData.ReturnMessages && oData.ReturnMessages.results.length > 0) {
							var aMsgcheck = this._generateMessages(oData.ReturnMessages.results);
							this._addMessage(aMsgcheck);
							this.hideBusy();
							if (aMsgcheck.length > 0) this.byId('popoverButton').firePress();
						}
					} else if (oData.ReturnMessages && oData.ReturnMessages.results.length > 0) {
						var aMsg = this._generateMessages(oData.ReturnMessages.results);
						this._addMessage(aMsg);
						this.hideBusy();
						if (aMsg.length > 0) this.byId('popoverButton').firePress();
					} else if (oData.showmanualtrack) {
						//check tracking numbers
						var TrackingNumber = [];
						oData.Freightunits.results.forEach(function (oitem) {
							TrackingNumber.push({
								manualtrack: ""
							})
						})
						this.getModel("local").setProperty("/SelectedTrackingNumber", TrackingNumber);
						if (!this.oTrackNumbersDlg) {
							this.oTrackNumbersDlg = sap.ui.xmlfragment("com.erpis.shiperp.parcel.hr7.fragment.tracking.TrackingNumbers", this);
							this.getView().addDependent(this.oTrackNumbersDlg);
						}
						this.oTrackNumbersDlg.open();
					} else {
						if (oData.showProNum) {
							if (!this.oDialogLTL) {
								this.oDialogLTL = sap.ui.xmlfragment("com.erpis.shiperp.parcel.hr7.fragment.CreateProNumber", this);
								this.getView().addDependent(this.oDialogLTL);
							}
							this.oDialogLTL.open();
							this.hideBusy();
						} else {
							this._refreshPackingData();
							// check type error
							if (aMsg) {
								var found = aMsg.find(function (item) {
									return item.type === "Error";
								});
							}
							// Tracking Data
							var oTracking = {};
							if (oData.ShipmentTrackingsSet.results.length > 0) {
								var oBasicData = this.getModel("local").getProperty("/basic");
								oTracking = oData.ShipmentTrackingsSet.results[oData.ShipmentTrackingsSet.results.length - 1];
								// Previous Shipment
								var oPreviousShipment = {
									carrier: oBasicData.carrier_data.carrier,
									service: oBasicData.carrier_data.service,
									billing_option: oBasicData.payment.billing_option,
									shipment_date: oBasicData.date_time.shipment_date,
									weight: oTracking.totaldimweight,
									rate: oTracking.rate,
									trackingno: oTracking.mastertrack
								};
								this.getModel("local").setProperty("/PreviousShipment", oPreviousShipment);
								if (!found) {
									MessageToast.show(this.oBundle.getText("ExecuteSuccess", [oTracking.mastertrack]));
								}
							}

							// Print Shipment Labels
							if (oData.ShipmentLabelSet) {
								if (oData.ShipmentLabelSet.results.length === 0) {
									MessageBox.error(this.oBundle.getText("NoPrintPreview"));
								} else {
									var sPath;
									for (var i = 0; i < oData.ShipmentLabelSet.results.length; i++) {
										var shipmentLabelItem = oData.ShipmentLabelSet.results[i];
										sPath = this.getModel().sServiceUrl + "/ShipmentLabelSet(shipmentid='',Guid='" + shipmentLabelItem.Guid +
											"')/$value";
										//Handle ZPL Axo 4780
										if (shipmentLabelItem.OutputType.indexOf("ZPL") !== -1) {
											this.onHandleReprintZPLDataType(sPath, false);
											// return;
										} else {
											//other type download
											sap.m.URLHelper.redirect(sPath, true);
										}
									}
								}
							}
							var sSap_message = oResponse.headers['sap-message'];
							if (sSap_message) {
								this._handleOdataResponse(oResponse);
							}
							if (iValue) {
								sap.ui.getCore().byId("txtLTL").setValue("");
							}
						}
					}

				}.bind(this),
				error: function (oError) {
					this.oSelectedHu = null;
					this._handleODataError(oError);
					this.hideBusy();
				}.bind(this)
			});
		},

		// onAddtrakingnumberScan: function (oEvent) {
		// 	var oControl;
		// 	if (oEvent.type === "sapfocusleave") {
		// 		oControl = jQuery(oEvent.target).control()[0];
		// 	} else {
		// 		oControl = oEvent.getSource();
		// 	}
		// 	var sString = oControl.getValue();
		// 	if (!sString) {
		// 		return;
		// 	}
		// var trimmedValue = sString.replace(/\s/g, '');
		// if (trimmedValue.length > 8) {
		// 	var chunks = [];
		// 	for (var i = 0; i < trimmedValue.length; i += 8) {
		// 		chunks.push(trimmedValue.substr(i, 8));
		// 	}
		// 	var formattedValue = chunks.join(' ');
		// 	oControl.setValue(formattedValue);
		// }
		// },

		onCloseTrackingNumbers: function () {
			// reset serial list to origin
			this.oTrackNumbersDlg.close();
			this.hideBusy();
		},
		onAcceptPress: function () {
			var aManualtrack = this.getModel("local").getProperty("/SelectedTrackingNumber");
			this._execute(null, null, aManualtrack);
			this.oTrackNumbersDlg.close();
		},

		onClearTrackingNumber: function (oEvent) {
			var aTrackingNumber = this.getModel("local").getProperty("/SelectedTrackingNumber");
			for (var i = 0; i < aTrackingNumber.length; i++) {
				aTrackingNumber[i].manualtrack = "";
			}
			this.getModel("local").setProperty("/SelectedTrackingNumber", aTrackingNumber);
		},

		onChangeMunualShipInputText: function (oEvent) {
			var oControl;
			if (oEvent.type === "sapfocusleave") {
				oControl = jQuery(oEvent.target).control()[0];
			} else {
				oControl = oEvent.getSource();
			}
			var sString = oControl.getValue();
			if (!sString) {
				return;
			}
			var sArr = sString.split(" ");
			var aManualtrack = this.getModel("local").getProperty("/SelectedTrackingNumber");
			sArr.forEach(function (item) {
				var text = item;
				for (var i = 0; i < aManualtrack.length; i++) {
					if (aManualtrack[i].manualtrack === "") {
						aManualtrack[i].manualtrack = text;
						break;
					}
				}
			}.bind(this));
			this.getModel("local").setProperty("/SelectedTrackingNumber", aManualtrack);
			oControl.setValue("");
		},

		_selectNextItem: function () {
			if (!this.oSelectedHu) {
				return;
			}
			var oHUTab = this.oHUTable;
			var aHUItems = oHUTab.getItems();
			var iSelectedIndex = -1;

			aHUItems.forEach(function (item, index) {
				if (item.getBindingContext("local").getObject().freightunitkey === this.oSelectedHu.getBindingContext("local").getObject().freightunitkey) {
					iSelectedIndex = index;
					return;
				}
			}.bind(this));
			if (iSelectedIndex < 0) {
				return;
			}
			for (var i = iSelectedIndex + 1; i < aHUItems.length; i++) {
				var oItemData = aHUItems[i].getBindingContext("local").getObject();
				if (oItemData.trackingnumber === "") {
					aHUItems[i].setSelected(true);
					return;
				}
			}
			// remove selection list
			this.oSelectedHu = null;
		},

		_generateExecuteUsecase: function (sActionName, iValue, aManualtrack, flag) {
			if (!sActionName) {
				sActionName = "Execute";
			}
			var sMPSStatus = this.getModel("local").getProperty("/basic/carrier_data/mps/mps");
			var aFreightUnits = [];
			var sMPSType = this.getModel("local").getProperty("/basic/carrier_data/mps/mpstype");
			if (sMPSStatus === "X" && sMPSType === "02") {
				aFreightUnits = this.getModel("local").getProperty("/Freightunits");
			} else {
				aFreightUnits = this._getSelectedFreightUnits();
			}
			var aInternational = this.getModel("local").getProperty("/Internationaloptions");
			//updated 20/10/2021 by Tim for remove prefix
			this.handleCarrierMoreOptionDataBeforeGenerate();
			this.handleHazmatOptionDataBeforeGenerate();
			if (aInternational) {
				this.handleInternationlOptionDataBeforeGenerate();
			}
			if (aInternational) {
				aInternational.forEach(function (item) {
					if (typeof item.FieldValue2 !== "string") {
						item.FieldValue2 = JSON.stringify(item.FieldValue2);
						item.Searchhelp = JSON.stringify(item.Searchhelp);
					}
					delete item.__metadata;
				});
			}
			var aCarrier_more_option = this.getModel("local").getProperty("/ShipmentCarrierOptions");
			if (aCarrier_more_option.length > 0) {
				aCarrier_more_option.forEach(function (obj) {
					if (typeof obj.FieldValue2 !== "string") {
						obj.FieldValue2 = JSON.stringify(obj.FieldValue2);
						obj.Searchhelp = JSON.stringify(obj.Searchhelp);
					}
				});
			}

			aFreightUnits.forEach(function (items) {
				items.FreightunitHazmat.results.forEach(function (itemhazmat) {
					if (itemhazmat.freightunit_hazmatopt.results) {
						itemhazmat.freightunit_hazmatopt.results.forEach(function (obj) {
							if (typeof obj.FieldValue2 !== "string") {
								obj.FieldValue2 = JSON.stringify(obj.FieldValue2);
								obj.Searchhelp = JSON.stringify(obj.FieldValue2);
							}
						});
					}
				});
			});

			var oData = {
				shipmentid: "",
				inputids: (this.sInputIDs) ? this.sInputIDs : "",
				inputtype: (this.sInputType) ? this.sInputType : "",
				profile: (this.sProfile) ? this.sProfile : "",
				shippingstation: (this.sStation) ? this.sStation : "",
				action: sActionName,
				basic: this.getModel("local").getProperty("/basic"),
				carrier_more_option: this.getModel("local").getProperty("/ShipmentCarrierOptions"),
				Freightunits: aFreightUnits,
				HTS: this.getModel("local").getProperty("/HTS"),
				References: this.getModel("local").getProperty("/References"),
				ShipmentTrackingsSet: [],
				ShipmentLabelSet: [],
				NaftaDetailSet: this.getModel("local").getProperty("/NaftaDetailSet"),
				TrackingNumber: (aManualtrack) ? aManualtrack : [],
				proNumber: iValue ? iValue : "",
				ReturnMessages: [],
				International: (aInternational) ? aInternational : [],
			};
			return oData;
		},

		_filterAllDropdowns: function () {

			/////// PARCEL TAB ///////
			// Filter the Carrier Service Dropdown based on Carrier
			var oSelectService = this.byId("selectService");
			oSelectService.getBinding("items").filter(new Filter("carrier", "EQ", this.sCarrier));

			// Filter the Package Type Dropdown based on Carrier
			this.byId("selectPackage").getBinding("items").filter(new Filter("Carrier", "EQ", this.sCarrier));

			/*
			// Commentout by Tim on 30/9/2021 change to use dynamic carrier more option
			/////// CARRIER SPECIFIC TAB ///////
			if (this.sCarrier === "FDXE") {
				this.byId("cbCollTypeFDXE").getBinding("items").filter(new Filter("Carrier", "EQ", this.sCarrier));
				this.byId("cbSignatureOpt").getBinding("items").filter(new Filter("Carrier", "EQ", this.sCarrier));
				this.byId("cbFedExReturnService").getBinding("items").filter(new Filter("Carrier", "EQ", this.sCarrier));
			} else if (this.sCarrier === "FDXG") {
				this.byId("cbCollTypeFDXG").getBinding("items").filter(new Filter("Carrier", "EQ", this.sCarrier));
				this.byId("cbSignatureOptG").getBinding("items").filter(new Filter("Carrier", "EQ", this.sCarrier));
				this.byId("cbFedExReturnServiceG").getBinding("items").filter(new Filter("Carrier", "EQ", this.sCarrier));
			} else if (this.sCarrier === "UPS") {
				this.byId("cbCollType").getBinding("items").filter(new Filter("Carrier", "EQ", this.sCarrier));
				this.byId("cbUPSReturnService").getBinding("items").filter(new Filter("Carrier", "EQ", this.sCarrier));
				this.byId("cbDeliveryConf").getBinding("items").filter(new Filter("Carrier", "EQ", this.sCarrier));
			}
			*/

			/////// SHIP FROM/TO + SOLD TO TAB ///////
			// Filter the Shipfrom Region Dropdown based on Country
			var oShipFromStateSel = this.byId("slShipFromState");
			oShipFromStateSel.getBinding("items").filter(new Filter("Country", "EQ", this.getModel("local").getProperty(
				"/basic/partners/shipfrom/address/country")));
			oShipFromStateSel.getBinding("items").attachDataReceived(function () {
				oShipFromStateSel.setSelectedKey(this.getModel("local").getProperty("/basic/partners/shipfrom/address/state"));
			}.bind(this), this);

			// Filter the Shipto Region Dropdown based on Country
			var oShipToStateSel = this.byId("slShipToState");
			oShipToStateSel.getBinding("items").filter(new Filter("Country", "EQ", this.getModel("local").getProperty(
				"/basic/partners/shipto/address/country")));
			oShipToStateSel.getBinding("items").attachDataReceived(function () {
				oShipToStateSel.setSelectedKey(this.getModel("local").getProperty("/basic/partners/shipto/address/state"));
				if (oShipToStateSel.getSelectedItem()) {
					this.getModel("local").setProperty("/Header/ShipToState", oShipToStateSel.getSelectedItem().getText());
				} else {
					this.getModel("local").setProperty("/Header/ShipToState", "");
				}
			}.bind(this), this);

			// Filter the Soldto Region Dropdown based on Country
			var oSoldToStateSel = this.byId("slSoldToState");
			oSoldToStateSel.getBinding("items").filter(new Filter("Country", "EQ", this.getModel("local").getProperty(
				"/basic/partners/soldto/address/country")));
			oSoldToStateSel.getBinding("items").attachDataReceived(function () {
				oSoldToStateSel.setSelectedKey(this.getModel("local").getProperty("/basic/partners/soldto/address/state"));
			}.bind(this), this);

			/////// INTERNATIONAL TAB ///////
			// Filter dropdowns based on domestic or international flag
			// if (!this.getModel("local").getProperty("/basic/shipment_flags/domestic")) {
			// 	// Filter the Importer Region Dropdown based on Country
			// 	var oImporterStateSel = this.byId("slImporterState");
			// 	oImporterStateSel.getBinding("items").filter(new Filter("Country", "EQ", this.getModel("local").getProperty(
			// 		"/basic/partners/importer/address/country")));
			// 	oImporterStateSel.getBinding("items").attachDataReceived(function () {
			// 		oImporterStateSel.setSelectedKey(this.getModel("local").getProperty("/basic/partners/importer/address/state"));
			// 	}.bind(this), this);

			// Carrier specific international controls

			// if (this.sCarrier === "FDXE" || this.sCarrier === "FDXG") {
			// FedEx internation state filter
			// var oFedExInternationalStateSel = this.byId("slFedExInternationalState");
			// oFedExInternationalStateSel.getBinding("items").filter(new Filter("Country", "EQ", this.getModel("local").getProperty(
			// 	"/basic/international/customs_broker/brokercountry")));
			// oFedExInternationalStateSel.getBinding("items").attachDataReceived(function () {
			// 	oFedExInternationalStateSel.setSelectedKey(this.getModel("local").getProperty(
			// 		"/basic/international/customs_broker/brokerstate"));
			// }.bind(this), this);
			//
			// FedEx internation state filter
			// var oFedExInternationalStateSels = this.byId("cbfdxgInternationalState");
			// oFedExInternationalStateSels.getBinding("items").filter(new Filter("Country", "EQ", this.getModel("local").getProperty(
			// 	"/basic/international/customs_broker/brokercountry")));
			// oFedExInternationalStateSels.getBinding("items").attachDataReceived(function () {
			// 	oFedExInternationalStateSels.setSelectedKey(this.getModel("local").getProperty(
			// 		"/basic/international/customs_broker/brokerstate"));
			// }.bind(this), this);
			//
			// this.byId("cbFedExTermOfSale").getBinding("items").filter(new Filter("Carrier", "EQ", this.sCarrier));
			// this.byId("cbfdxgTermOfSale").getBinding("items").filter(new Filter("Carrier", "EQ", this.sCarrier));
			// //
			// this.byId("cbFedExSalePurpose").getBinding("items").filter(new Filter("Carrier", "EQ", this.sCarrier));
			// this.byId("cbfdxgSalePurpose").getBinding("items").filter(new Filter("Carrier", "EQ", this.sCarrier));
			// //
			// this.byId("cbFedExRegulatoryControl").getBinding("items").filter(new Filter("Carrier", "EQ", this.sCarrier));
			// this.byId("cbfdxgRegulatoryControl").getBinding("items").filter(new Filter("Carrier", "EQ", this.sCarrier));
			// //
			// this.byId("cbFedExTinType").getBinding("items").filter(new Filter("Carrier", "EQ", this.sCarrier));
			// this.byId("cbfdxgTinType").getBinding("items").filter(new Filter("Carrier", "EQ", this.sCarrier));
			// //
			// this.byId("cbBrokerTinType").getBinding("items").filter(new Filter("Carrier", "EQ", this.sCarrier));
			// this.byId("cbfdxgBrokerTinType").getBinding("items").filter(new Filter("Carrier", "EQ", this.sCarrier));
			// //
			// this.byId("cbStatementType").getBinding("items").filter(new Filter("Carrier", "EQ", this.sCarrier));
			// this.byId("cbfdxgStatementType").getBinding("items").filter(new Filter("Carrier", "EQ", this.sCarrier));
			//
			// var oBinding = this.byId("cbFedExITNNumber").getBinding("items");
			// var aFilters = [];
			// if (this.sCarrier === "FDXG") {
			// 	var oCarrierHollow = new Filter("Carrier", "EQ", "");
			// 	var oCarrierData = new Filter("Carrier", "EQ", this.sCarrier);
			// 	aFilters.push(oCarrierHollow);
			// 	aFilters.push(oCarrierData);
			// 	var oFilterOR = new Filter({
			// 		filters: aFilters,
			// 		and: false
			// 	});
			// 	oBinding.filter(oFilterOR);
			// } else if (this.sCarrier === "FDXE") {
			// 	this.byId("cbFedExITNNumber").getBinding("items").filter(new Filter("Carrier", "EQ", this.sCarrier));
			// }
			//
			// var oBindings = this.byId("cbfdxgITNNumber").getBinding("items");
			// var aFilter = [];
			// if (this.sCarrier === "FDXG") {
			// 	var oCarrierHollows = new Filter("Carrier", "EQ", "");
			// 	var oCarrierDatas = new Filter("Carrier", "EQ", this.sCarrier);
			// 	aFilter.push(oCarrierHollows);
			// 	aFilter.push(oCarrierDatas);
			// 	var oFilterORs = new Filter({
			// 		filters: aFilters,
			// 		and: false
			// 	});
			// 	oBindings.filter(oFilterORs);
			// } else if (this.sCarrier === "FDXE") {
			// 	this.byId("cbfdxgITNNumber").getBinding("items").filter(new Filter("Carrier", "EQ", this.sCarrier));
			// }
			// } else if (this.sCarrier === "UPS" || this.sCarrier === "PRLA" || this.sCarrier === "CNWY" || this.sCarrier === "GEN") {
			// 	this.byId("cbUPSTermOfSale").getBinding("items").filter(new Filter("Carrier", "EQ", this.sCarrier));
			// 	this.byId("cbUPSSalePurpose").getBinding("items").filter(new Filter("Carrier", "EQ", this.sCarrier));
			// 	this.byId("cbUPSRegulatoryControl").getBinding("items").filter(new Filter("Carrier", "EQ", this.sCarrier));
			// 	this.byId("cbUPSTinType").getBinding("items").filter(new Filter("Carrier", "EQ", this.sCarrier));
			// 	this.byId("cbUPSITNNumber").getBinding("items").filter(new Filter("Carrier", "EQ", this.sCarrier));
			// } else if (this.sCarrier === "CNWY" || this.sCarrier === "GEN") {
			// 	this.byId("cbTermOfSale").getBinding("items").filter(new Filter("Carrier", "EQ", this.sCarrier));
			// 	this.byId("cbSalePurpose").getBinding("items").filter(new Filter("Carrier", "EQ", this.sCarrier));
			// 	this.byId("cbRegulatoryControl").getBinding("items").filter(new Filter("Carrier", "EQ", this.sCarrier));
			// 	this.byId("cbTinType").getBinding("items").filter(new Filter("Carrier", "EQ", this.sCarrier));
			// 	this.byId("cbITNNumber").getBinding("items").filter(new Filter("Carrier", "EQ", this.sCarrier));
			// }
			// }
		},

		_updateRegion: function (sId, sCountry) {
			var oRegionControl = this.byId(sId);
			oRegionControl.getBinding("items").filter(new Filter("Country", "EQ", sCountry));
			oRegionControl.setSelectedKey("");
		},

		_updateRegionDialog: function (sId, sCountry) {
			var oRegionControl = sap.ui.getCore().byId(sId);
			oRegionControl.getBinding("items").filter(new Filter("Country", "EQ", sCountry));
			oRegionControl.setSelectedKey("");
		},

		_displayTabs: function () {
			// Domestic/International Tabs
			var bDomestic = this.getModel("local").getProperty("/basic/shipment_flags/domestic");
			if (bDomestic) {
				this.byId("iconTabInternational").setVisible(false);
				this.byId("iconTabImporter").setVisible(false);
				this.byId("btnHTS").setVisible(false);
			} else {
				this.byId("iconTabInternational").setVisible(true);
				this.byId("iconTabImporter").setVisible(true);
				this.byId("btnHTS").setVisible(true);
			}

		},
		//Added by Tim 19/11/2021 Axo 4770
		_displayShipmentCarrierMoreOptTab: function () {
			//Display carrier more option dynamic added by Tim 8/9/2021
			var aCarrierMoreOptions = this.getModel("local").getProperty("/ShipmentCarrierOptions");
			var aShipmentCarrierMoreOptions = this._convertStringtoJson(aCarrierMoreOptions);
			if (aShipmentCarrierMoreOptions && aShipmentCarrierMoreOptions.length > 0) {
				var aDataFixed = this._checkDuplicateObjInArr(aShipmentCarrierMoreOptions, "object_name");
				this.getModel("local").setProperty("/ShipmentCarrierOptions", aDataFixed);
				// Carrier specific Tab
				this.oShipmentCarrierOptionTab = this.byId("iconTabCarrierSub");
				this.byId("iconTabCarrier").setVisible(true);
				this.oShipmentCarrierOptionTab.setTitle(this.getModel("local").getProperty("/basic/carrier_data/CarrierName"));
				this._generateShipmentCarrierMoreOption(aShipmentCarrierMoreOptions, this.oShipmentCarrierOptionTab);

			}
		},
		/**
		 * Remove Dublicate value of object_name in array
		 * @param: aSource
		 * @param: sObject - value to check duplicate
		 * @return unique array
		 * @last modified: Michael 23/7/2023
		 * */
		_checkDuplicateObjInArr: function (aSource, sObject) {
			var oValueKey = {};
			// Count occurrences of each object_name
			for (var i = 0, len = aSource.length; i < len; i++) {
				var objectName = aSource[i][sObject];
				if (aSource[i].object_name !== "") {
					if (oValueKey[objectName] === undefined) {
						oValueKey[objectName] = 1;
					} else {
						oValueKey[objectName]++;
					}
				}
			}
			// Get objects_names with occurrences greater than 1
			for (var key in oValueKey) {
				if (oValueKey[key] > 1) {
					var found = aSource.find(function (item) {
						return item.object_name === key && item.value_list.results.length > 0;
					});
					for (var j = 0; j < aSource.length; j++) {
						if (found) {
							if (aSource[j].object_name === key && aSource[j].value_list.results.length === 0) {
								aSource[j].value_list = found.value_list;
							}
						}

					}
				}
			}
			return aSource;
		},

		_getDefaultWeightScale: function () {
			var oDeferred = $.Deferred();
			this.getModel().read("/xSERPERPxCDS_PROFILE", {
				filters: [
					new Filter("Profile", "EQ", this.sProfile)
				],
				success: function (oData) {
					if (oData.results.length > 0) {
						this.sDefaultUseScale = "000" + oData.results[0].UseScale;
						this.getModel("local").setProperty("/UseScale", this.sDefaultUseScale);
					}

					//Hooks in Standard Controller for making controller extension
					if (this.afterScanWithDefaultWeightScale) {
						this.afterScanWithDefaultWeightScale(oData);
					}

					oDeferred.resolve();
				}.bind(this),
				error: function () {
					oDeferred.resolve();
				}.bind(this)
			});
			return oDeferred;
		},

		_displayMessageStripHeader: function () {
			try {
				var aServiceList = this.getModel("local").getProperty("/ServiceList");
				for (var i = 0; i < aServiceList.length; i++) {
					if (aServiceList[i].carrier === this.sCarrier &&
						aServiceList[i].service === this.getModel("local").getProperty("/basic/carrier_data/service")) {
						this.getModel("local").setProperty("/Header/ServiceName", aServiceList[i].description);
						break;
					}
				}
			} catch (exc) {
				this.oLogger.info("No Service Name");
			}
			try {
				this.getModel("local").setProperty("/Header/ShipToCountry", this.byId("cbShipToCountry").getSelectedItem().getText());
			} catch (exc) {
				this.oLogger.info("No Ship To Country");
			}
			try {
				this.getModel("local").setProperty("/Header/ShipToState", this.byId("slShipToState").getSelectedItem().getText());
			} catch (exc) {
				this.oLogger.info("No Ship To State");
			}
			try {
				this.getModel("local").setProperty("/Header/BillingOption", this.byId("cbBillingOptionParcel").getSelectedItem().getText());
			} catch (exc) {
				this.oLogger.info("No Billing Option");
			}
			try {
				this.getModel("local").setProperty("/Header/TPCountry", this.byId("cbThirdPartyCountry").getSelectedItem().getText());
			} catch (exc) {
				this.oLogger.info("No 3rdParty Country");
			}
		},

		_displaySerialList: function (oSelectedSerialMaster) {
			this.aOriginialSerialItemSet = [];
			// add more item
			if (oSelectedSerialMaster.SerialItemSet.results.length < parseInt(oSelectedSerialMaster.anzsers, 10)) {
				var iNumberItemToAdd = parseInt(oSelectedSerialMaster.anzsers, 10) - parseInt(oSelectedSerialMaster.anzser, 10);

				for (var i = 0; i < iNumberItemToAdd; i++) {
					var oSerial = {
						SERNR: "",
						POSNR: oSelectedSerialMaster.posnr,
						VBELN: oSelectedSerialMaster.vbeln,
						shipmentid: ""
					};
					oSelectedSerialMaster.SerialItemSet.results.push(oSerial);
				}
			}
			this.getModel("local").setProperty("/SelectedSerial", oSelectedSerialMaster);
		},

		_generateValidateAddressUsecase: function () {
			var sActionName = "ValidateAddress";
			var oData = {
				shipmentid: "",
				inputids: (this.sInputIDs) ? this.sInputIDs : "",
				inputtype: (this.sInputType) ? this.sInputType : "",
				profile: (this.sProfile) ? this.sProfile : "",
				shippingstation: (this.sStation) ? this.sStation : "",
				action: sActionName,
				basic: this.getModel("local").getProperty("/basic"),
				Freightunits: this.getModel("local").getProperty("/Freightunits"),
				HTS: this.getModel("local").getProperty("/HTS"),
				References: this.getModel("local").getProperty("/References"),
				CarrierRates: [],
				ReturnMessages: []
			};
			return oData;
		},

		_generatePostSerialsUsecase: function () {
			var sActionName = "PostSerials";
			var aMasterList = this.getModel("local").getProperty("/MasterSerialList");
			var oData = {
				shipmentid: "",
				inputids: (this.sInputIDs) ? this.sInputIDs : "",
				inputtype: (this.sInputType) ? this.sInputType : "",
				profile: (this.sProfile) ? this.sProfile : "",
				shippingstation: (this.sStation) ? this.sStation : "",
				action: sActionName,
				SerialSet: aMasterList
			};
			return oData;
		},

		_updateShippingStatus: function () {
			var aFreightUnits = this.getModel("local").getProperty("/Freightunits");
			if (aFreightUnits) {
				var bCanShip = false;
				//Axo 4669, 4770
				if (aFreightUnits.length === 0) {
					bCanShip = true;
					this.getModel("local").setProperty("/CanShip", bCanShip);
					return;
				}
				for (var i = 0; i < aFreightUnits.length; i++) {
					if (aFreightUnits[i].trackingnumber === "") {
						bCanShip = true;
						break;
					}
				}
				this.getModel("local").setProperty("/CanShip", bCanShip);
			}
		},

		_getSelectedFreightUnits: function () {
			var aFreightUnits = [];
			var aSelectedHus = this.oHUTable.getSelectedItems();
			if (aSelectedHus.length === 0) {
				// select all item
				aFreightUnits = this.getModel("local").getProperty("/Freightunits");
			} else {
				for (var i = 0; i < aSelectedHus.length; i++) {
					aFreightUnits.push(aSelectedHus[i].getBindingContext("local").getObject());

				}
			}
			return aFreightUnits;
		},

		_getHazardous: function () {
			var oSelectedHu = this.oHUTable.getSelectedItem();
			var sKey = oSelectedHu.getBindingContext("local").getObject().freightunitkey;
			var aLocalHazmats = this._getLocalFreightUnitHazmatItems(oSelectedHu.getBindingContext("local").getObject());
			if (aLocalHazmats.length > 0) {
				this.getModel("local").setProperty("/FreightunitHazmats", aLocalHazmats);
				this.oHazmatDialog.open();
				this._handleBindingSubPanel(aLocalHazmats);
				return;
			}
			this.showBusy();
			var oRequestData = this._generateHazardousUsecase();
			this.getModel().create("/ShipmentQuerySet", oRequestData, {
				success: function (oData) {
					this.getModel("local").setProperty("/Bindingcarriername", oData.basic.carrier_data.CarrierName);
					this.getModel("local").setProperty("/Freightunits", oData.Freightunits.results);
					var aResults = oData.Freightunits.results[0].FreightunitHazmat.results;
					this.getModel("local").setProperty("/FreightunitHazmats", aResults);
					this.getModel("local").setProperty("/BindingHazmatOpt", aResults[0].freightunit_hazmatopt.results);
					this.mFreightUnitHazmatItems[sKey] = aResults;
					// this.getModel("local").setProperty("/BindingHazmatOptCarrcode", aHazmat[0].It_HazmatOpt.results[0]);
					this.oHazmatDialog = Utils.getFragment("", "HazmatDialog", this);
					this._getHazmatoptionAndTable();
					this.oHazmatDialog.open();
					this._handleBindingSubPanel(aResults);
					// this._handleBindingSubPanel(aHazmatItems);
					this.hideBusy();
				}.bind(this),
				error: function (oError) {
					this._handleODataError(oError);
					this.hideBusy();
				}.bind(this)
			});
		},

		_handleBindingSubPanel: function (aResults) {
			var sCurrentIndex = 0;
			aResults.forEach(function (item, index) {
				if (item.Selected == "X") {
					sCurrentIndex = index;
				}
			});
			var sCurrentPath = "local>/FreightunitHazmats/" + sCurrentIndex;
			this._updatePackingInstrHazmatsSubPanel(aResults[sCurrentIndex], sCurrentPath);
			var oDetailContainer = this.getView().byId("hazmatDetailContainer");
			oDetailContainer.bindElement(sCurrentPath);
		},

		_updatePackingInstrHazmatsSubPanel: function (oCurentObject, sCurrentPath) {
			var oData = oCurentObject;
			if (oData.Auth === "LTD.QTY") {
				oData.Packinstr = oData.Packinstr3;
			} else {
				if (oData.Airservices === "1" || oData.Airservices === "3") {
					oData.Packinstr = oData.Packinstr2;
				} else if (oData.Airservices === "2") {
					oData.Packinstr = oData.Packinstr1;
				} else if (oData.Airservices === "4") {
					oData.Packinstr = oData.Packinstr4;
				}
			}
			this.getModel("local").setProperty(sCurrentPath, oData);
		},

		_getLocalFreightUnitHazmatItems: function (oSelectedFreightUnitItem) {
			var sKey = oSelectedFreightUnitItem.freightunitkey;
			var aResults = [];
			var aHazmatContinues = oSelectedFreightUnitItem.FreightunitHazmat.results || oSelectedFreightUnitItem.FreightunitHazmat;
			aResults = this.mFreightUnitHazmatItems[sKey] || [];
			if (aHazmatContinues.length > 0) {
				// merge
				for (var i = 0; i < aHazmatContinues.length; i++) {
					for (var j = 0; j < aResults.length; j++) {
						if (aResults[j].hu_id === aHazmatContinues[i].hu_id && aResults[j].linenumber === aHazmatContinues[i].linenumber) {
							aResults[j] = aHazmatContinues[i];
							break;
						}
					}
				}
			}
			return aResults;
		},
		_getSelectedFreightUnitsHaz: function () {
			var aFreightUnits = [];
			var aSelectedHus = this.oHUTable.getSelectedItems();
			if (aSelectedHus.length === 0) {
				// select all item
				aFreightUnits = this.getModel("local").getProperty("/Freightunits");
			} else {
				for (var i = 0; i < aSelectedHus.length; i++) {
					var aFreightunit = aSelectedHus[i].getBindingContext("local").getObject();
					//handle hazmat opt
					if (aFreightunit.FreightunitHazmat.results.length > 0) {
						aFreightunit.FreightunitHazmat.results.forEach(function (obj) {
							if (obj.freightunit_hazmatopt.results === undefined) {
								obj.freightunit_hazmatopt = [{
									value_list: []
								}]
							} else {
								obj.freightunit_hazmatopt.results.forEach(function (items) {
									if (typeof items.FieldValue2 !== "string") {
										items.FieldValue2 = JSON.stringify(items.FieldValue2);
									} else if (typeof items.Searchhelp !== "string") {
										items.Searchhelp = JSON.stringify(items.Searchhelp);
									}
								});
							}
						});
					} else {
						aFreightunit.FreightunitHazmat.results.push({
							freightunit_hazmatopt: [{
								value_list: []
							}]
						});
					}
					//handle carrier more option
					aFreightunit.carrier_more_option.results.forEach(function (items) {
						if (typeof items.FieldValue2 !== "string") {
							items.FieldValue2 = JSON.stringify(items.FieldValue2);
						} else if (typeof items.Searchhelp !== "string") {
							items.Searchhelp = JSON.stringify(items.Searchhelp);
						}
					});

					aFreightUnits.push(aSelectedHus[i].getBindingContext("local").getObject());
				}
			}
			return aFreightUnits;
		},

		_generateHazardousUsecase: function () {
			var aFreightUnits = this._getSelectedFreightUnitsHaz();
			var oData = {
				shipmentid: "",
				inputids: (this.sInputIDs) ? this.sInputIDs : "",
				inputtype: (this.sInputType) ? this.sInputType : "",
				profile: (this.sProfile) ? this.sProfile : "",
				shippingstation: (this.sStation) ? this.sStation : "",
				action: "GetHazmatTable",
				basic: this.getModel("local").getProperty("/basic"),
				Freightunits: aFreightUnits

			};
			return oData;
		},

		_validateHazmat: function () {
			var oRequestData = this._generateValidateHazmatUsecase();
			this.showBusy();
			this.getModel().create("/ShipmentQuerySet", oRequestData, {
				success: function () {
					var oBinding = this.byId(this.getView().createId("hazmatDetailContainer")).getBindingContext("local");
					var oData = oBinding.getObject();
					oData.Updated = "X";
					this.getModel("local").setProperty(oBinding.getPath(), oData);
					this.hideBusy();
					MessageToast.show(this.oBundle.getText("hazmatValidateSuccess"));
				}.bind(this),
				error: function (oError) {
					this._handleODataError(oError);
					this.hideBusy();
				}.bind(this)
			});
		},

		_generateValidateHazmatUsecase: function () {
			var aFreightUnits = this._getSelectedFreightUnits();
			// var oHazmat = this.byId(this.getView().createId("hazmatDetailContainer")).getBindingContext("local").getObject();
			// if (!oHazmat) {
			// 	return null;
			// }
			// aFreightUnits[0].FreightunitHazmat = [oHazmat];
			var oData = {
				shipmentid: "",
				inputids: (this.sInputIDs) ? this.sInputIDs : "",
				inputtype: (this.sInputType) ? this.sInputType : "",
				profile: (this.sProfile) ? this.sProfile : "",
				shippingstation: (this.sStation) ? this.sStation : "",
				action: "ValidateHazmat",
				basic: this.getModel("local").getProperty("/basic"),
				Freightunits: aFreightUnits
			};
			return oData;
		},

		_validateAllHazmat: function () {
			var oRequestData = this._generateValidateAllHazmatUsecase();
			this.showBusy();
			this.getModel().create("/ShipmentQuerySet", oRequestData, {
				success: function () {
					var oSelectedHu = this.oHUTable.getSelectedItem();
					var sPath = oSelectedHu.getBindingContext("local").getPath();
					var oHuData = oSelectedHu.getBindingContext("local").getObject();
					var aHazmat = [];
					var oItem;
					for (var i = 0; i < this.getModel("local").getProperty("/FreightunitHazmats").length; i++) {
						oItem = this.getModel("local").getProperty("/FreightunitHazmats")[i];
						if (oItem.Selected === "X" && oItem.Updated === "X") {
							aHazmat.push(oItem);
						}
					}
					oHuData.FreightunitHazmat = aHazmat;
					this.getModel("local").setProperty(sPath, oHuData);
					this.oHazmatDialog.close();
					this.hideBusy();
				}.bind(this),
				error: function (oError) {
					this._handleODataError(oError);
					this.hideBusy();
				}.bind(this)
			});
		},

		_generateValidateAllHazmatUsecase: function () {
			var aFreightUnits = this._getSelectedFreightUnits();
			var aHazmat = this.getModel("local").getProperty("/FreightunitHazmats");
			aFreightUnits[0].FreightunitHazmat = aHazmat;
			var oData = {
				shipmentid: "",
				inputids: (this.sInputIDs) ? this.sInputIDs : "",
				inputtype: (this.sInputType) ? this.sInputType : "",
				profile: (this.sProfile) ? this.sProfile : "",
				shippingstation: (this.sStation) ? this.sStation : "",
				action: "ValidateAllHazmat",
				basic: this.getModel("local").getProperty("/basic"),
				Freightunits: aFreightUnits
			};
			return oData;
		},

		_updatePackingInstr: function (oBinding) {
			var oData = oBinding.getObject();
			if (oData.Auth === "LTD.QTY") {
				oData.Packinstr = oData.Packinstr3;
			} else {
				if (oData.Airservices === "1" || oData.Airservices === "3") {
					oData.Packinstr = oData.Packinstr2;
				} else if (oData.Airservices === "2") {
					oData.Packinstr = oData.Packinstr1;
				} else if (oData.Airservices === "4") {
					oData.Packinstr = oData.Packinstr4;
				}
			}
			this.getModel("local").setProperty(oBinding.getPath(), oData);
		},

		_numOfShippedItems: function (aItemsControl) {
			var iNumOfShippedItems = 0;
			var oItemData = {};
			for (var i = 0; i < aItemsControl.length; i++) {
				oItemData = aItemsControl[i].getBindingContext("local").getObject();
				if (oItemData.trackingnumber !== "") {
					iNumOfShippedItems++;
				}
			}
			return iNumOfShippedItems;
		},

		_numOfShippedHU: function (aFreightunits) {
			var iNumOfShippedItems = 0;
			var oItemData = {};
			for (var i = 0; i < aFreightunits.length; i++) {
				oItemData = aFreightunits[i];
				if (oItemData.trackingnumber !== "") {
					iNumOfShippedItems++;
				}
			}
			return iNumOfShippedItems;
		},

		_getShippedItems: function () {
			var aSelectedHUs = this.oHUTable.getItems();
			var oItemData = {};
			var aShippedItems = [];
			for (var i = 0; i < aSelectedHUs.length; i++) {
				oItemData = aSelectedHUs[i].getBindingContext("local").getObject();
				if (oItemData.trackingnumber !== "") {
					Array.prototype.push.apply(aShippedItems, oItemData.FreightunitItems.results);
				}
			}
			return aShippedItems;
		},

		editFreightUnit: function (isEdit, sFreightunitkey, sColumnName) {
			var sUseScale = this.getModel("local").getProperty("/UseScale");
			var aFreightUnitEdits = this.getModel("local").getProperty("/aFreightUnitEdits") || [];
			var bResult = true;
			if (sUseScale === "0003") {
				// disable dims_unit column
				if (sColumnName === "dims_unit") {
					bResult = false;
				} else {
					bResult = true;
				}
			} else if (sUseScale === "0002" && aFreightUnitEdits.indexOf(sFreightunitkey) >= 0) {
				// disable dims_unit column
				if (sColumnName === "dims_unit") {
					bResult = false;
				} else {
					bResult = true;
				}
			} else if (sUseScale === "0001" && aFreightUnitEdits.indexOf(sFreightunitkey) >= 0) {
				// disable weight column
				if (sColumnName === "weight") {
					bResult = false;
				} else {
					bResult = true;
				}
			} else {
				//  usecase undefine
				if (isEdit === "true") {
					return false;
				} else {
					return true;
				}
			}

			if (isEdit === "true") {
				return bResult;
			} else {
				return !bResult;
			}
		},

		_getDeliveryFromHeader: function (oMultiInput) {
			var aDeliveries = [];
			if (oMultiInput.getTokens().length > 0) {
				for (var i = 0; i < oMultiInput.getTokens().length; i++) {
					var sTokenValue = oMultiInput.getTokens()[i].getText();
					aDeliveries.push({
						key: sTokenValue
					});
				}
			}
			return aDeliveries;
		},

		_printPreviewHazmat: function () {
			var oRequestData = this._generatePrintPreviewHazmatUsecase();
			this.showBusy();
			this.getModel().create("/ShipmentQuerySet", oRequestData, {
				success: function (oData) {
					if (oData.HazmatPrintSet) {
						if (oData.HazmatPrintSet.results.length === 0) {
							MessageBox.error(this.oBundle.getText("NoPrintPreview"));
						} else {
							var sPath;
							for (var i = 0; i < oData.HazmatPrintSet.results.length; i++) {
								sPath = this.getModel().sServiceUrl + "/HazmatPrintSet(shipmentid='',Guid='" + oData.HazmatPrintSet.results[i].Guid +
									"')/$value";
								sap.m.URLHelper.redirect(sPath, true);
							}
							MessageToast.show(this.oBundle.getText("PrintSuccess"));
						}
					}
					this.hideBusy();
				}.bind(this),
				error: function (oError) {
					this._handleODataError(oError);
					this.hideBusy();
				}.bind(this)
			});
		},

		_generatePrintPreviewHazmatUsecase: function () {
			var oData = {
				shipmentid: "",
				inputids: (this.sInputIDs) ? this.sInputIDs : "",
				inputtype: (this.sInputType) ? this.sInputType : "",
				profile: (this.sProfile) ? this.sProfile : "",
				shippingstation: (this.sStation) ? this.sStation : "",
				action: "PrintPreviewHazmat",
				basic: this.getModel("local").getProperty("/basic"),
				Freightunits: this.getModel("local").getProperty("/Freightunits"),
				HTS: this.getModel("local").getProperty("/HTS"),
				References: this.getModel("local").getProperty("/References"),
				HazmatPrintSet: []
			};
			return oData;
		},

		_printHazmat: function () {
			var oRequestData = this._generatePrintHazmatUsecase();
			this.showBusy();
			this.getModel().create("/ShipmentQuerySet", oRequestData, {
				success: function () {
					MessageToast.show(this.oBundle.getText("PrintSuccess"));
					this.hideBusy();
				}.bind(this),
				error: function (oError) {
					this._handleODataError(oError);
					this.hideBusy();
				}.bind(this)
			});
		},

		_generatePrintHazmatUsecase: function () {
			var oData = {
				shipmentid: "",
				inputids: (this.sInputIDs) ? this.sInputIDs : "",
				inputtype: (this.sInputType) ? this.sInputType : "",
				profile: (this.sProfile) ? this.sProfile : "",
				shippingstation: (this.sStation) ? this.sStation : "",
				action: "PrintHazmat",
				basic: this.getModel("local").getProperty("/basic"),
				Freightunits: this.getModel("local").getProperty("/Freightunits"),
				HTS: this.getModel("local").getProperty("/HTS"),
				References: this.getModel("local").getProperty("/References")
			};
			return oData;
		},

		_checkBreakBulk: function () {
			var oRequestData = this._generateUsecase("UpdateBreakBulk");
			this.showBusy();
			this.getModel().create("/ShipmentQuerySet", oRequestData, {
				success: function (oData) {
					this.getModel("local").setProperty("/basic/partners/shipfrom", oData.basic.partners.shipfrom);
					// Filter all the available dropdowns
					this._filterAllDropdowns();
					MessageToast.show(this.oBundle.getText("BreakBulkUpdated"));
					this.hideBusy();
				}.bind(this),
				error: function (oError) {
					this._handleODataError(oError);
					this.hideBusy();
				}.bind(this)
			});
		},

		_generateUsecase: function (sAction) {
			var oData = {
				shipmentid: "",
				inputids: (this.sInputIDs) ? this.sInputIDs : "",
				inputtype: (this.sInputType) ? this.sInputType : "",
				profile: (this.sProfile) ? this.sProfile : "",
				shippingstation: (this.sStation) ? this.sStation : "",
				action: sAction,
				basic: this.getModel("local").getProperty("/basic"),
				Freightunits: this.getModel("local").getProperty("/Freightunits"),
				HTS: this.getModel("local").getProperty("/HTS"),
				References: this.getModel("local").getProperty("/References"),
				ShipmentTrackingsSet: []
			};
			return oData;
		},

		_updateHazmatChange: function (oBinding) {
			var oData = oBinding.getObject();
			var sPath = oBinding.getPath();
			if (oData.Updated !== "X") {
				return;
			}
			oData.Updated = "";

			this.getModel("local").setProperty(sPath, oData);
		},

		_checkShipmentComplete: function () {
			this.bCheckShipmentComplete = true;
			var bCompleteShipment = true;
			var aFreightUnits = this.getModel("local").getProperty("/Freightunits");
			if (aFreightUnits) {
				if (aFreightUnits.length === 0) {
					return;
				}
				for (var i = 0; i < aFreightUnits.length; i++) {
					var item = aFreightUnits[i];
					if (item.trackingnumber === "") {
						bCompleteShipment = false;
						break;
					}
				}
				if (bCompleteShipment) {
					MessageBox.information(this.oBundle.getText("shipmentCompleteMsg"));
				}

			}
		},
		_updateBillingInformation: function () {
			var oRequestData = this._generateSetBillingOptionUsecase();
			this.showBusy();
			this.getModel().create("/ShipmentQuerySet", oRequestData, {
				success: function (oData) {
					var oPayment = oData.basic.payment;
					this.getModel("local").setProperty("/basic/payment", oPayment);
					this.hideBusy();
				}.bind(this),
				error: function (oError) {
					this._handleODataError(oError);
					this.hideBusy();
				}.bind(this)
			});
		},

		_generateSetBillingOptionUsecase: function () {
			var sActionName = "SetBillingOption";
			var oData = {
				shipmentid: "",
				inputids: (this.sInputIDs) ? this.sInputIDs : "",
				inputtype: (this.sInputType) ? this.sInputType : "",
				profile: (this.sProfile) ? this.sProfile : "",
				shippingstation: (this.sStation) ? this.sStation : "",
				action: sActionName,
				basic: this.getModel("local").getProperty("/basic"),
				Freightunits: this.getModel("local").getProperty("/Freightunits"),
				HTS: this.getModel("local").getProperty("/HTS"),
				References: this.getModel("local").getProperty("/References")
			};
			return oData;
		},

		_copyObject: function (oTarget, oSource) {
			for (var property in oTarget) {
				if (oTarget.hasOwnProperty(property) && oSource.hasOwnProperty(property) && oSource[property] !== "") {
					if (typeof (oTarget[property]) === "object") {
						this._copyObject(oTarget[property], oSource[property]);
					} else {
						oTarget[property] = oSource[property];
					}

				}
			}
		},

		_updateHUAdvancedPackingDimensions: function (bHeader) {
			var oDeferred = $.Deferred();
			var oRequestData = this._generateUpdateHUFieldsUsecase(bHeader);
			this.showBusy();
			this.getModel().create("/ShipmentQuerySet", oRequestData, {
				success: function (oData) {
					// Update FreightunitHeaders json node
					oDeferred.resolve();
				}.bind(this),
				error: function (oError) {
					// this._handleODataError(oError);
					oDeferred.resolve();
				}.bind(this)
			});
			return oDeferred;
		},

		_generateUpdateHUFieldsUsecase: function (bHeader) {
			var sActionName = "UpdateHUFields";
			var oData = {};
			if (bHeader) {
				oData = {
					shipmentid: "",
					inputids: (this.sInputIDs) ? this.sInputIDs : "",
					inputtype: (this.sInputType) ? this.sInputType : "",
					profile: (this.sProfile) ? this.sProfile : "",
					shippingstation: (this.sStation) ? this.sStation : "",
					action: sActionName,
					basic: this.getModel("local").getProperty("/basic"),
					FreightunitHeaders: this.getModel("local").getProperty("/FreightunitHeaders")
				};
			} else {
				oData = {
					shipmentid: "",
					inputids: (this.sInputIDs) ? this.sInputIDs : "",
					inputtype: (this.sInputType) ? this.sInputType : "",
					profile: (this.sProfile) ? this.sProfile : "",
					shippingstation: (this.sStation) ? this.sStation : "",
					action: sActionName,
					basic: this.getModel("local").getProperty("/basic"),
					Freightunits: this.getModel("local").getProperty("/Freightunits")
				};
			}

			return oData;
		},

		_buildITHU: function () {
			var oRequestData = this._generateBuildITHUUsecase();
			this.showBusy();
			this.getModel().create("/ShipmentQuerySet", oRequestData, {
				success: function (oData) {
					// Update FreightunitHeaders json node
					if (oData.FreightunitHeaders) {
						if (oData.FreightunitHeaders.results) {
							this.getModel("local").setProperty("/FreightunitHeaders", oData.FreightunitHeaders.results);
						}
					} else {
						this.getModel("local").setProperty("/FreightunitHeaders", []);
					}
					// Update Freightunits json node
					if (oData.Freightunits) {
						for (var i = 0; i < oData.Freightunits.results.length; i++) {
							if (!oData.Freightunits.results[i].FreightunitItems) {
								oData.Freightunits.results[i].FreightunitItems = [];
							}
							if (!oData.Freightunits.results[i].FreightunitItems.results) {
								oData.Freightunits.results[i].FreightunitItems = [];
							}
							if (!oData.Freightunits.results[i].FreightunitHazmat) {
								oData.Freightunits.results[i].FreightunitHazmat = [];
							}
							if (!oData.Freightunits.results[i].FreightunitHazmat.results) {
								oData.Freightunits.results[i].FreightunitHazmat = [];
							}
						}
						this.getModel("local").setProperty("/Freightunits", oData.Freightunits.results);
					} else {
						this.getModel("local").setProperty("/Freightunits", []);
					}
					this.hideBusy();
				}.bind(this),
				error: function (oError) {
					this._handleODataError(oError);
					this.hideBusy();
				}.bind(this)
			});
		},

		_generateBuildITHUUsecase: function () {
			var sActionName = "BuildItHU";
			var sLeftTableFilterType = "";
			var oFilterCombobox = this.byId(this.getView().createId(sap.ui.core.Fragment.createId("advancedModeHU", "cbFilterLeftTable")));
			if (oFilterCombobox) {
				if (oFilterCombobox.getSelectedItem()) {
					sLeftTableFilterType = oFilterCombobox.getSelectedItem().getKey();
				}
			}
			var oData = {
				shipmentid: sLeftTableFilterType, // Use for BuildITHU usecase only
				inputids: (this.sInputIDs) ? this.sInputIDs : "",
				inputtype: (this.sInputType) ? this.sInputType : "",
				profile: (this.sProfile) ? this.sProfile : "",
				shippingstation: (this.sStation) ? this.sStation : "",
				action: sActionName,
				basic: this.getModel("local").getProperty("/basic"),
				Freightunits: this.getModel("local").getProperty("/Freightunits"),
				FreightunitHeaders: this.getModel("local").getProperty("/FreightunitHeaders"),
				HTS: this.getModel("local").getProperty("/HTS"),
				References: this.getModel("local").getProperty("/References")
			};
			return oData;
		},

		_packHUToHU: function () {
			var oRequestData = this._generatePackHUToHUUsecase();
			this.showBusy();
			this.getModel().create("/ShipmentQuerySet", oRequestData, {
				success: function () {
					MessageToast.show(this.oBundle.getText("PackHUSuccess"));
					this._refreshPackingData();
				}.bind(this),
				error: function (oError) {
					this._handleODataError(oError);
					this.hideBusy();
				}.bind(this)
			});
		},

		_generatePackHUToHUUsecase: function () {
			var aSelectedItems = this.oHULeftTable.getSelectedItems();
			var oSelectedRightItem = this.oHURightTable.getSelectedItem();
			var aFreightunits = [];
			var aFreightunitHeaders = [];
			var sTargetHU = this.oHURightTable.getSelectedItem().getBindingContext("local").getObject().freightunitkey;
			for (var i = 0; i < aSelectedItems.length; i++) {
				aFreightunits.push(aSelectedItems[i].getBindingContext("local").getObject());
			}
			aFreightunitHeaders.push(oSelectedRightItem.getBindingContext("local").getObject());
			var oData = {
				shipmentid: "",
				inputids: (this.sInputIDs) ? this.sInputIDs : "",
				inputtype: (this.sInputType) ? this.sInputType : "",
				profile: (this.sProfile) ? this.sProfile : "",
				shippingstation: (this.sStation) ? this.sStation : "",
				action: "PackHUToHU",
				targethu: sTargetHU,
				basic: this.getModel("local").getProperty("/basic"),
				HTS: this.getModel("local").getProperty("/HTS"),
				References: this.getModel("local").getProperty("/References"),
				Freightunits: aFreightunits,
				FreightunitHeaders: aFreightunitHeaders
			};
			return oData;
		},

		_unpackHUFromHU: function () {
			var oRequestData = this._generateUnpackHUFromHUUsecase();
			this.showBusy();
			this.getModel().create("/ShipmentQuerySet", oRequestData, {
				success: function () {
					MessageToast.show(this.oBundle.getText("HUUnpackSuccess"));
					this._refreshPackingData();
				}.bind(this),
				error: function (oError) {
					this._handleODataError(oError);
					this.hideBusy();
				}.bind(this)
			});
		},

		_generateUnpackHUFromHUUsecase: function () {
			var oSelectedRightItem = this.oHURightTable.getSelectedItem();
			var aFreightunitHeaders = [];
			aFreightunitHeaders.push(oSelectedRightItem.getBindingContext("local").getObject());
			var oData = {
				shipmentid: "",
				inputids: (this.sInputIDs) ? this.sInputIDs : "",
				inputtype: (this.sInputType) ? this.sInputType : "",
				profile: (this.sProfile) ? this.sProfile : "",
				shippingstation: (this.sStation) ? this.sStation : "",
				action: "UnpackHUFromHU",
				basic: this.getModel("local").getProperty("/basic"),
				FreightunitHeaders: aFreightunitHeaders
			};
			return oData;
		},

		_showPackingOverview: function (sHU, sObject) {
			this.showBusy();
			var oParam = {
				object: this.sObject,
				objectkey: this.sObjectKey
			};
			//Tim added for specify HuClick
			if (sObject === "06") {
				oParam.object = sObject;
				oParam.objectkey = sHU;
			}

			this.getModel().callFunction("/ShowPackingOverview", {
				urlParameters: oParam,
				success: function (oData) {
					this.hideBusy();
					var aTempOutput = [];
					var aOutput = [];
					//Tim added 22/9/2021
					if (sObject === "06") {
						//for FU item click
						aOutput = this.treeify(oData.results, "node_id", "parent_id");
					} else {
						//for advance mode
						if (sHU) {
							for (var i = 0; i < oData.results.length; i++) {
								if (parseInt(oData.results[i].node_desc, 10) === parseInt(sHU, 10)) {
									aTempOutput.push(oData.results[i]);
								}
							}
							aOutput = this.treeify(aTempOutput, "node_id", "parent_id");
						} else {
							aOutput = this.treeify(oData.results, "node_id", "parent_id");
						}
					}

					if (aOutput.length > 0) {
						// First Level
						if (aOutput[0].Children.length > 0) {
							for (i = 0; i < aOutput[0].Children.length; i++) {
								aOutput[0].Children[i].outermost = "Success";

								// Second Level
								for (var j = 0; j < aOutput[0].Children[i].Children.length; j++) {
									aOutput[0].Children[i].Children[j].state = "Bold";
								}
							}
						}
					}
					this.getModel("local").setProperty("/PackingOverviewList", aOutput);
					this.oPackingOverviewDialog = Utils.getFragment("", "packing.PackingOverviewDialog", this);
					this.oPackingOverviewDialog.open();
					this.hideBusy();
				}.bind(this),
				error: function (oError) {
					this._handleODataError(oError);
					this.hideBusy();
				}.bind(this)
			});
		},

		// This method is used to check which scenario the packing is in. Value return:
		//   '01': Pack by Material on Main screen
		//	 '02': Pack by Material on Advance Dialog
		//   '03': Pack by HU on Advance Dialog
		_getPackingScenario: function () {
			if (this.oHULeftTable && this.oHURightTable) { // when Advance Packing dialog is open
				// Retrieve the carousel object in this advanced packing dialog and determine what scenario is being active
				var oCarousel = this.byId("AdvancePackingCarousel");
				var sCarouselFirstPage = oCarousel.getPages()[0].getId();
				if (oCarousel.getActivePage() === sCarouselFirstPage) { // Scenario 1 (Pack by Material)
					return "02";
				} else { // Scenario 2 (Pack by HU)
					return "03";
				}
			} else { // Pack by Material on Main screen
				return "01";
			}
		},

		// Refresh Packing Data
		_refreshPackingData: function (bIgnoreEditableFields) {
			var oDeferred = $.Deferred();
			// Get the selected HUs depending on the Packing scenario
			if (this._getPackingScenario() === "01") { // Main Screen Scenario
				if (bIgnoreEditableFields === undefined) {
					// Update editable fields in the backend
					oDeferred = this._updateHUAdvancedPackingDimensions(false);
					$.when(oDeferred).done(function () {
						this._getContentAndHUTable("All");
						oDeferred = $.Deferred();
					}.bind(this));
				} else {
					if (bIgnoreEditableFields) {
						this.showBusy();
						this._getContentAndHUTable("All");
					} else {
						// Update editable fields in the backend
						oDeferred = this._updateHUAdvancedPackingDimensions(false);
						$.when(oDeferred).done(function () {
							this._getContentAndHUTable("All");
							oDeferred = $.Deferred();
						}.bind(this));
					}
				}
			} else if (this._getPackingScenario() === "02") { // Pack by Material Dialog
				if (bIgnoreEditableFields === undefined) {
					// Update editable fields in the backend
					oDeferred = this._updateHUAdvancedPackingDimensions(false);
					$.when(oDeferred).done(function () {
						this._getContentAndHUTable("All");
						oDeferred = $.Deferred();
					}.bind(this));
				} else {
					if (bIgnoreEditableFields) {
						this._getContentAndHUTable("All");
					} else {
						// Update editable fields in the backend
						oDeferred = this._updateHUAdvancedPackingDimensions(false);
						$.when(oDeferred).done(function () {
							this._getContentAndHUTable("All");
							oDeferred = $.Deferred();
						}.bind(this));
					}
				}
			} else if (this._getPackingScenario() === "03") { // Pack by HU Dialog
				this._buildITHU();
			} else { // Default
				if (bIgnoreEditableFields === undefined) {
					// Update editable fields in the backend
					oDeferred = this._updateHUAdvancedPackingDimensions(false);
					$.when(oDeferred).done(function () {
						this._getContentAndHUTable("All");
						oDeferred = $.Deferred();
					}.bind(this));
				} else {
					if (bIgnoreEditableFields) {
						this._getContentAndHUTable("All");
					} else {
						// Update editable fields in the backend
						oDeferred = this._updateHUAdvancedPackingDimensions(false);
						$.when(oDeferred).done(function () {
							this._getContentAndHUTable("All");
							oDeferred = $.Deferred();
						}.bind(this));
					}
				}
			}
		},

		_getExternalScale: function () {
			var oDeferred = $.Deferred();
			var aSelectedHUs = this.oHUTable.getSelectedItems();
			this.showBusy();
			this.getModel().callFunction("/GetExternalScale", {
				urlParameters: {
					ShippingStation: this.sStation
				},
				success: function (oData) {
					if (oData.GetExternalScale.Weight && oData.GetExternalScale.WeightUnit) {
						var aHUs = this.getModel("local").getProperty("/Freightunits");
						for (var i = 0; i < aSelectedHUs.length; i++) {
							var oObject = aSelectedHUs[i].getBindingContext("local").getObject();
							for (var j = 0; j < aHUs.length; j++) {
								if (aHUs[j].freightunitkey === oObject.freightunitkey) {
									if (aHUs[j].freightunitkey === "") {
										delete aHUs[j].weight;
										delete aHUs[j].height;
										delete aHUs[j].length;
										delete aHUs[j].weight_unit;
										delete aHUs[j].width;
									} else if (parseFloat(oObject.weight) === parseFloat(oData.GetExternalScale.Weight)) {
										this.sHUWeightExtScaleChange = "";
									} else {
										aHUs[j].weight = parseFloat(oData.GetExternalScale.Weight).toFixed(2);
										this.iOriginalExtScaleWeight = aHUs[j].Weight;
										this.sOriginalExtScaleWeightUnit = oData.GetExternalScale.WeightUnit;
										aHUs[j].weight_unit = oData.GetExternalScale.WeightUnit;
									}
								}
							}
						}
						this.getModel("local").setProperty("/Freightunits", aHUs);
						this.getModel("local").setProperty("/aHandlingUnitEdits", []);
						// this.enableEditHandlingUnitsforExternalScale(false);
					}
					oDeferred.resolve(true);
					this.hideBusy();
				}.bind(this),
				error: function (oError) {
					this.getModel("local").setProperty("/aHandlingUnitEdits", []);
					// this.enableEditHandlingUnitsforExternalScale(false);
					this._handleODataError(oError);
					oDeferred.resolve(false);
					this.hideBusy();
				}.bind(this)
			});
			return oDeferred;
		},
		_bindEmptyPickupReadyTimeFDXE: function () {
			var sPickupReDate = this.byId("fdxePickupReDate").getValue();
			if (!sPickupReDate) {
				this.byId("fdxePickupReTime").setValue("");
				this.byId("fdxePickupLaTime").setValue("");
			}
		},
		_bindEmptyPickupReadyTimeFDXG: function () {
			var sPickupReDate = this.byId("fdxgPickupReDate").getValue();
			if (!sPickupReDate) {
				this.byId("fdxgPickupReTime").setValue("");
				this.byId("fdxgPickupLaTime").setValue("");
			}
		},

		_getPackageCarrierMoreOptions: function (oMoreOptionData, sFUItemPath) {
			//set global
			this.currentFUPath = sFUItemPath;
			var oFreightUnitItemRow = this.getModel("local").getProperty(sFUItemPath);
			this.oMoreOptionDialog = Utils.getFragment(null, "packing.MoreOptionsDialog", this);
			this.oMoreOptionDialog.destroyContent();

			//Tim Added 25/10/2021 Axo 4559
			if (this.sCarrier && oFreightUnitItemRow.freightunitkey) {
				var HUNo = formatter.removeLeadingZero(oFreightUnitItemRow.freightunitkey);
				var dialogTitle = this.oBundle.getText("packageLevelCarrierMoreOptTitle", [this.sCarrier, HUNo]);
				this.oMoreOptionDialog.setTitle(dialogTitle);
			}
			this.hideBusy();
			// Generate More Options Forms
			var aPackageFields = Utils._addPrefixToFieldName(oMoreOptionData.results, "PACKAGE_");
			var aConverJson = this._convertStringtoJson(aPackageFields);
			DynamicView.renderMoreOptionForm(aConverJson, this, false);
			//Set current data

			this.getModel("local").setProperty(sFUItemPath, oFreightUnitItemRow);
			// Open dialog
			this.getView().addDependent(this.oMoreOptionDialog);
			this.oMoreOptionDialog.open();
			this.hideBusy();
		},
		onMoreOptionClose: function () {
			if (this.oMoreOptionDialog.getContent()[0]) {
				DynamicView.getDynamicDataForDialog(this.oMoreOptionDialog, this, DynamicView, false);
			}
			this.oMoreOptionDialog.close();
		},
		_generateShipmentCarrierMoreOption: function (aShipmentCarrierMoreOptions, oContainer) {
			this.oShipmentCarrierOptionTab = oContainer;
			//resset shipment
			if (this.oShipmentCarrierOptionTab.getBlocks()[0] instanceof sap.m.FlexBox) {
				if (this.oShipmentCarrierOptionTab.getBlocks()[0].getItems()[0] instanceof sap.m.FlexBox) {
					this.oShipmentCarrierOptionTab.getBlocks()[0].getItems()[0].removeAllContent();
				} else {
					this.oShipmentCarrierOptionTab.getBlocks()[0].getItems()[1].removeAllItems()
				}
			} else {
				var oCurrForm = this.oShipmentCarrierOptionTab.getBlocks()[0];
				if (oCurrForm) {
					oCurrForm.removeAllContent();
				}
			}
			this.oShipmentCarrierOptionTab.removeAllBlocks();
			//add prefix before process
			var aShipmentFields = Utils._addPrefixToFieldName(aShipmentCarrierMoreOptions, "SHIPMENT_");
			//Axo 4770
			this.isCanShip = this.getModel("local").getProperty("/CanShip");
			DynamicView.renderShipmentCarrierOptionForm(aShipmentFields, this, false);
		},
		getFinalShipmentCarrierOptionData: function (oShipmentCarrierOptionContainer) {
			if (oShipmentCarrierOptionContainer.getBlocks().length > 0) {
				var aCarrierMoreOptionsForm;
				if (oShipmentCarrierOptionContainer.getBlocks()[0] instanceof sap.m.FlexBox) {
					var aCarrierMoreOptionsForm = oShipmentCarrierOptionContainer.getBlocks()[0].getItems()[0];
				} else {
					var aCarrierMoreOptionsForm = oShipmentCarrierOptionContainer.getBlocks()[0];
				}
				DynamicView.getDynamicDataForShipmentCarrierOptionForm(aCarrierMoreOptionsForm, this, DynamicView);
			}

		},
		handleCarrierMoreOptionDataBeforeGenerate: function () {
			//Get carrier more option data Tim added 8/9/2021
			if (this.oShipmentCarrierOptionTab) {
				this.getFinalShipmentCarrierOptionData(this.oShipmentCarrierOptionTab);
			}
			//remove prefix before submit
			DynamicView.removePrefixPackage(this);
			DynamicView.removePrefixShipment(this);
		},
		onAddHTS: function () {
			var oRow = this._buildEmptyRow();
			var aHTS = this.getModel("local").getData().HTS;
			aHTS.unshift(oRow);
			this.getModel("local").setProperty("/TargetSystems", aHTS);
		},
		_buildEmptyRow: function () {
			var oRow = {
				htscode: "",
				ctryoforigin: "",
				description: "",
				netvalue: "",
				currency: "",
				weight: "",
				weight_unit: "",
				qty: "0",
				uom: "",
				qty2: "0",
				uom2: "",
				alumn: ""
			};
			return oRow;
		},
		onHTSSelectionChange: function (oEvent) {
			var sCurrPath = oEvent.getSource().getSelectedContexts()[0].getPath();
			this.sSelectedHTS = sCurrPath;
		},
		onDeleteHTS: function () {
			if (this.sSelectedHTS) {
				var aHTS = this.getModel("local").getData().HTS;
				aHTS.splice(this.sSelectedHTS, 1);
				this.getModel("local").setProperty("/TargetSystems", aHTS);
			} else {
				MessageBox.warning(this.oBundle.getText("SelectItemBeforeDelete"));
				return;
			}
		},
		onContinueHTSDialog: function () {
			var oRequestData = this._generateUsecase("UpdateHTS");
			this.showBusy();
			this.getModel().create("/ShipmentQuerySet", oRequestData, {
				success: function (oData) {
					if (oData.HTS.results) {
						this.getModel("local").setProperty("/HTS", oData.HTS.results);
					}
					MessageToast.show(this.oBundle.getText("SaveHarmonizedTariffSuccess"));
					this.hideBusy();
					this._oHTSDialog.close();
				}.bind(this),
				error: function (oError) {
					this._handleODataError(oError);
					this.hideBusy();
				}.bind(this)
			});
		},
		onSelectCommCodeService: function (oEvent) {
			this.showBusy();
			this.oCurrCommCodeControl = oEvent.getSource();
			var sRequestQuery = this.getModel().sServiceUrl + "/CommodityCodeSet?$filter=delivery eq '" + this.sInputIDs + "'";
			var fnSuccess = function (oData) {
				if (oData.d.results) {
					this.hideBusy();
					this.getModel("local").setProperty("/CommndityCode", oData.d.results);
					this._CommCodeDlg = Utils.getFragment(null, "CommodityCodeValueHelpDlg", this);
					this._CommCodeDlg.open();
				}
			}.bind(this);
			var fnError = function (oData) {
				this.hideBusy();
				MessageBox.show(this.oBundle.getText("ShowErrorMessage"));
			}.bind(this);
			HttpHelper.getData(sRequestQuery, fnSuccess, fnError);
		},
		handleSearchCommCode: function (oEvent) {
			var sValue = oEvent.getParameter("value").trim();
			var oBinding = oEvent.getParameter("itemsBinding");
			var aFilters = [];
			if (sValue) {
				aFilters.push(new Filter("Country", "Contains", sValue));
				aFilters.push(new Filter("CommodityCode", "Contains", sValue));
				aFilters.push(new Filter("Description", "Contains", sValue));
				oBinding.filter(new Filter({
					filters: aFilters,
					and: false
				}));
			} else {
				oBinding.filter([]);
			}
		},
		onSelectCommCodeConfirm: function (oEvent) {
			var oSelectedItem = oEvent.getParameter("selectedItem");
			if (oSelectedItem) {
				var oValue = oSelectedItem.getBindingContext("local").getObject();
				var sCommCode = oValue.stawn;
				var sCountry = oValue.ctryoforigin;
				var sDescription = oValue.description;
				this.oCurrCommCodeControl.setValue(sCommCode);
				this.oCurrCommCodeControl.getParent().getBindingContext("local").getObject().ctryoforigin = sCountry;
				this.oCurrCommCodeControl.getParent().getBindingContext("local").getObject().description = sDescription;
				this.getView().byId("idHTSList").getBinding("items").refresh(true);
			}
			oEvent.getSource().getBinding("items").filter([]);
		},

		_generateUsecaseAcountDetail: function () {
			var oData = {
				shipmentid: "",
				inputids: (this.sInputIDs) ? this.sInputIDs : "",
				inputtype: (this.sInputType) ? this.sInputType : "",
				profile: (this.sProfile) ? this.sProfile : "",
				shippingstation: (this.sStation) ? this.sStation : "",
				action: "Get3rdPartyAccount",
				basic: this.getModel("local").getProperty("/basic"),
				Freightunits: this.getModel("local").getProperty("/Freightunits"),
				HTS: this.getModel("local").getProperty("/HTS"),
				References: this.getModel("local").getProperty("/References"),
				ShipmentTrackingsSet: []
			};
			return oData;
		},

		onCancelProcessShipment: function () {
			this.oShipmentAddrValid.close();
		},
		onAcceptProcessShipment: function () {
			var flag = "X";
			this._execute(null, null, null, flag);
			this.oShipmentAddrValid.close();
		},

		onPressAccountSearch: function () {
			var oRequestData = this._generateUsecaseAcountDetail();
			this.showBusy();
			this.getModel().create("/ShipmentQuerySet", oRequestData, {
				success: function (oData) {
					if (oData.Custom_Fields !== null) {
						if (oData.Custom_Fields.ZAccountsT.results.length > 0) {
							this.getModel("local").setProperty("/AcountDetail", oData.Custom_Fields.ZAccountsT.results);
						}
					} else {
						this.getModel("local").setProperty("/AcountDetail", []);
					}
					this.oAccountSearch = Utils.getFragment("", "AccountSearch", this);
					this.oAccountSearch.open();
					this.hideBusy();
				}.bind(this),
				error: function (oError) {
					this._handleODataError(oError);
					this.hideBusy();
				}.bind(this)
			});

		},

		onAccountConfirm: function (oEvent) {
			var oSelectedItem = oEvent.getParameter("selectedItem").getBindingContext("local").getObject();
			var othirdpartyacct = this.getModel("local").getProperty("/basic/payment/thirdpartyacct");
			othirdpartyacct.account = oSelectedItem.Accountnumber;
			if (othirdpartyacct.account !== "") {
				var bcheck = false;
				this.getModel("local").setProperty("/basic/payment/billing_option", "3PRTY");
				this.getModel("local").setProperty("/basic/payment/ppaid_add", bcheck);
			}
			this.getModel("local").setProperty("/basic/payment/thirdpartyacct", othirdpartyacct);
			// Update Message Strip Header
			this._displayMessageStripHeader();
		},

		AccountHelpSearch: function (oEvent) {
			var sValue = oEvent.getParameter("value").trim();
			var oBinding = oEvent.getParameter("itemsBinding");
			var aFilters = [];
			if (sValue) {
				aFilters.push(new Filter("SiteID", "Contains", sValue));
				aFilters.push(new Filter("Accountnumber", "Contains", sValue));
				oBinding.filter(new Filter({
					filters: aFilters,
					and: false
				}));
			} else {
				oBinding.filter([]);
			}
		},

		_getHazmatoptionAndTable: function () {
			var aHazmatOption = this.getModel("local").getProperty("/BindingHazmatOpt");
			if (aHazmatOption && aHazmatOption.length > 0) {
				this.oHazmatOptions = this.byId("idRenderFormHaz");
				//resset shipment
				this.oHazmatOptions.removeAllContent();
				var aConverJsonHazmatOption = this._convertStringtoJsonHazmat(aHazmatOption);
				DynamicView.renderHazmatOptionForm(aConverJsonHazmatOption, this, false);
			}
		},
		_convertStringtoJsonHazmat: function (aHazmatOption) {
			aHazmatOption.forEach(function (obj) {
				if (typeof obj.FieldValue2 === "string" && obj.FieldValue2 !== "") {
					obj.FieldValue2 = JSON.parse(obj.FieldValue2);
				}
			});
			return aHazmatOption;
		},

		// hazmat option
		handleHazmatOptionDataBeforeGenerate: function () {
			if (this.oHazmatOptions) {
				this.getFinalHazmatOptionData(this.oHazmatOptions);
			}
			//remove prefix before submit
			DynamicView.removePrefixShipment(this);
		},
		getFinalHazmatOptionData: function (oHazmatOptions) {
			if (oHazmatOptions.getContent().length > 0) {
				var oHazmatOptionsForm;
				if (oHazmatOptions.getContent()[0] instanceof sap.m.FlexBox) {
					oHazmatOptionsForm = oHazmatOptions.getContent()[0].getItems()[0]
				} else {
					oHazmatOptionsForm = oHazmatOptions.getContent()[0];
				}
				DynamicView.getDynamicDataForHazmatOptionForm(oHazmatOptionsForm, this, DynamicView);
			}
		},
		onchangeAccount: function (oEvent) {
			var oControl = oEvent.getParameter("value").trim();
			if (oControl !== "") {
				this.getModel("local").setProperty("/basic/payment/billing_option", "3PRTY")
			} else {
				this.getModel("local").setProperty("/basic/payment/billing_option", "PPAID")
			}
		},
		_displayShipmentInternationOprionTab: function () {
			var aInternationOption = this.getModel("local").getProperty("/Internationaloptions");
			var aShipmentInternationOption = this._convertStringtoJson(aInternationOption);
			if (aShipmentInternationOption && aShipmentInternationOption.length > 1 || aShipmentInternationOption.length > 0) {
				// Internation specific Tab
				this.oShipmentInternationalOptions = this.byId("iconTabInternationSub");
				this.byId("iconTabInternational").setVisible(true);
				this.oShipmentInternationalOptions.setTitle("InterNational");
				this._generateShipmentInterNationOptions(aShipmentInternationOption, this.oShipmentInternationalOptions);
			} else {
				this.byId("iconTabInternational").setVisible(false);
			}
		},

		_convertStringtoJson: function (aShipmentOption) {
			aShipmentOption.forEach(function (obj) {
				if (typeof obj.FieldValue2 === "string" && obj.FieldValue2 !== "") {
					obj.FieldValue2 = JSON.parse(obj.FieldValue2);
				}
				if (typeof obj.Searchhelp === "string" && obj.Searchhelp !== "") {
					obj.Searchhelp = JSON.parse(obj.Searchhelp);
				}
			});
			return aShipmentOption;
		},

		_generateShipmentInterNationOptions: function (aShipmentInternationOption, oContainer) {
			this.oShipmentInternationalOptions = oContainer;
			//resset shipment
			if (this.oShipmentInternationalOptions.getBlocks()[0] instanceof sap.m.FlexBox) {
				if (this.oShipmentInternationalOptions.getBlocks()[0].getItems()[0] instanceof sap.m.FlexBox) {
					this.oShipmentInternationalOptions.getBlocks()[0].getItems()[0].removeAllContent();
				} else {
					this.oShipmentInternationalOptions.getBlocks()[0].getItems()[1].removeAllItems();
				}
			} else {
				var oCurrForm = this.oShipmentInternationalOptions.getBlocks()[0];
				if (oCurrForm) {
					oCurrForm.removeAllContent();
				}
			}
			this.oShipmentInternationalOptions.removeAllBlocks();
			//add prefix before process
			var aShipmentFields = Utils._addPrefixToFieldName(aShipmentInternationOption, "SHIPMENTX_");
			this.isCanShip = this.getModel("local").getProperty("/CanShip");
			DynamicView.renderShipmentInternationalOptionForm(aShipmentFields, this, false);
		},

		getFinalShipmentInternationOptionData: function (oShipmentInternationalOptionContainer) {
			if (oShipmentInternationalOptionContainer.getBlocks().length > 0) {
				var aInternationMoreOptionsForm;
				if (oShipmentInternationalOptionContainer.getBlocks()[0] instanceof sap.m.FlexBox) {
					var aInternationMoreOptionsForm = oShipmentInternationalOptionContainer.getBlocks()[0].getItems()[0];
				} else {
					var aInternationMoreOptionsForm = oShipmentInternationalOptionContainer.getBlocks()[0];
				}
				DynamicView.getDynamicDataForShipmentInternationOptionForm(aInternationMoreOptionsForm, this, DynamicView);
			}

		},

		handleInternationlOptionDataBeforeGenerate: function () {
			if (this.oShipmentInternationalOptions) {
				this.getFinalShipmentInternationOptionData(this.oShipmentInternationalOptions);
			}
			//remove prefix before submit
			// DynamicView.removePrefixPackage(this);
			DynamicView.removePrefixInternationalShipment(this);
		},

		onShowPopupShipment: function () {
			if (this.byId("dsc").getShowSideContent()) {
				this.byId("dsc").setShowSideContent(false);
			} else {
				this.byId("dsc").setShowSideContent(true);
			}

		},

		ConvertstringtoString: function (aData) {
			aData.forEach(function (items) {
				if (items.carrier_more_option.results) {
					items.carrier_more_option.results.forEach(function (obj) {
						if (typeof obj.FieldValue2 !== "string") {
							obj.FieldValue2 = JSON.stringify(obj.FieldValue2);
							obj.Searchhelp = JSON.stringify(obj.FieldValue2);
						}
					});
				}
			});
			return aData;
		},

		_generateParcelUsecase: function () {
			var sMPSStatus = this.getModel("local").getProperty("/basic/carrier_data/mps/mps");
			var aFreightUnits = [];
			var sMPSType = this.getModel("local").getProperty("/basic/carrier_data/mps/mpstype");
			if (sMPSStatus === "X" && sMPSType === "02") {
				aFreightUnits = this.getModel("local").getProperty("/Freightunits");
			} else {
				aFreightUnits = this._getSelectedFreightUnits();
			}
			var aInternational = this.getModel("local").getProperty("/Internationaloptions");
			//updated 20/10/2021 by Tim for remove prefix
			this.handleCarrierMoreOptionDataBeforeGenerate();
			this.handleHazmatOptionDataBeforeGenerate();
			if (aInternational) {
				this.handleInternationlOptionDataBeforeGenerate();
			}
			if (aInternational) {
				aInternational.forEach(function (item) {
					if (typeof item.FieldValue2 !== "string") {
						item.FieldValue2 = JSON.stringify(item.FieldValue2);
						item.Searchhelp = JSON.stringify(item.Searchhelp);
					}
					delete item.__metadata;
				});
			}

			var aCarrier_more_option = this.getModel("local").getProperty("/ShipmentCarrierOptions");
			if (aCarrier_more_option.length > 0) {
				aCarrier_more_option.forEach(function (obj) {
					if (typeof obj.FieldValue2 !== "string") {
						obj.FieldValue2 = JSON.stringify(obj.FieldValue2);
						obj.Searchhelp = JSON.stringify(obj.Searchhelp);
					}
				});
			}

			aFreightUnits.forEach(function (items) {
				items.FreightunitHazmat.results.forEach(function (itemhazmat) {
					if (itemhazmat.freightunit_hazmatopt.results) {
						itemhazmat.freightunit_hazmatopt.results.forEach(function (obj) {
							if (typeof obj.FieldValue2 !== "string") {
								obj.FieldValue2 = JSON.stringify(obj.FieldValue2);
								obj.Searchhelp = JSON.stringify(obj.FieldValue2);
							}
						});
					}
				});
			});

			var oData = {
				shipmentid: "",
				inputids: (this.sInputIDs) ? this.sInputIDs : "",
				inputtype: (this.sInputType) ? this.sInputType : "",
				profile: (this.sProfile) ? this.sProfile : "",
				shippingstation: (this.sStation) ? this.sStation : "",
				action: "SaveDelivery",
				basic: this.getModel("local").getProperty("/basic"),
				carrier_more_option: this.getModel("local").getProperty("/ShipmentCarrierOptions"),
				Freightunits: aFreightUnits,
				HTS: this.getModel("local").getProperty("/HTS"),
				References: this.getModel("local").getProperty("/References"),
				ShipmentTrackingsSet: [],
				ShipmentLabelSet: [],
				NaftaDetailSet: this.getModel("local").getProperty("/NaftaDetailSet"),
				ReturnMessages: [],
				International: (aInternational) ? aInternational : [],
			};
			return oData;
		},

		onSaveParceclick: function () {
			var oRequestData = this._generateParcelUsecase();
			this.showBusy();
			this.getModel().create("/ShipmentQuerySet", oRequestData, {
				success: function (oData) {

					this.hideBusy();
				}.bind(this),
				error: function (oError) {
					this._handleODataError(oError);
					this.hideBusy();
				}.bind(this)
			});
		}

		//end
	});
});