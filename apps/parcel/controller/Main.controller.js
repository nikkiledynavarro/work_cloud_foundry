/*global location*/
jQuery.sap.require("com.erpis.shiperp.parcel.common.jquery_hotkeys");
sap.ui.define([
	"com/erpis/shiperp/parcel/controller/BaseController",
	"sap/ui/model/json/JSONModel",
	"com/erpis/shiperp/parcel/model/formatter",
	"sap/m/Token",
	"sap/ui/model/Filter",
	"sap/m/MessageBox",
	"sap/m/MessageToast",
	"com/erpis/shiperp/parcel/common/Utils",
	"com/erpis/shiperp/parcel/common/hotkeyInterface"
], function (BaseController, JSONModel, formatter, Token, Filter, MessageBox, MessageToast, Utils, HotkeyInterface) {
	"use strict";

	return BaseController.extend("com.erpis.shiperp.parcel.controller.Main", {

		oLogger: jQuery.sap.log.getLogger("com.erpis.shiperp.parcel.controller.Main"),
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
				}
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
			// Register event load for combobox input type
			this.byId("cbInputType").getBinding("items").attachDataReceived(this.onInputTypeLoaded, this);

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

			$.when(this.oInputTypeDeferred).done(function () {
				this.hideBusy();
			}.bind(this));
		},

		/* =========================================================== */
		/* event handlers                                              */
		/* =========================================================== */
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
					"$expand": "Freightunits/FreightunitItems,SerialSet,SerialSet/SerialItemSet,HTS,References,CarrierList,ServiceList,Contents,NaftaDetailSet,OrientationsSet"
				},
				success: function (oData) {
					if (oData.results.length !== 0 && oData.results[0].basic.carrier_data.carrier !== "") {
						// this.getModel("local").setProperty("/ShipmentQuery", oData.results[0]);
						this.getModel("local").setProperty("/Contents", oData.results[0].Contents.results);
						this.getModel("local").setProperty("/FreightunitHeaders", []);
						this.getModel("local").setProperty("/HTS", oData.results[0].HTS.results);
						this.getModel("local").setProperty("/References", oData.results[0].References.results);
						this.getModel("local").setProperty("/CarrierList", oData.results[0].CarrierList.results);
						this.getModel("local").setProperty("/ServiceList", oData.results[0].ServiceList.results);
						this.getModel("local").setProperty("/NaftaDetailSet", oData.results[0].NaftaDetailSet.results);
						this.getModel("local").setProperty("/basic", oData.results[0].basic);
						this.getModel("local").setProperty("/OrientationsSet", oData.results[0].OrientationsSet.results);

						// construct serial list
						this.getModel("local").setProperty("/MasterSerialList", oData.results[0].SerialSet.results);
						this.aOriginMasterSerialList = jQuery.extend(true, [], oData.results[0].SerialSet.results);

						// Keep the common properties at controller state
						this.sObject = this.getModel("local").getProperty("/basic/hu_object/Object");
						this.sObjectKey = this.getModel("local").getProperty("/basic/hu_object/ObjectKey");
						this.sCarrier = oData.results[0].basic.carrier_data.carrier;
						this.bCheckShipmentComplete = false;

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
							if (this.getModel("local").getProperty("/UseScale") !== "0002") {
								this.getModel("local").setProperty("/Freightunits", oData.results[0].Freightunits.results);
							}
							//Binding empty field when PickupReadyDate empty
							if (oData.results[0].basic.carrier_data.carrier === "FDXE") {
								this._bindEmptyPickupReadyTimeFDXE();
							} else if (oData.results[0].basic.carrier_data.carrier === "FDXG") {
								this._bindEmptyPickupReadyTimeFDXG();
							}
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
				this.oDialogDefaultHU = sap.ui.xmlfragment("com.erpis.shiperp.parcel.fragment.CreateDefaultHUDialog", this);
				this.getView().addDependent(this.oDialogDefaultHU);
			}
			this.oDialogDefaultHU.open();
		},

		// Add New HU section
		onAddNewHU: function () {
			if (!this.oDialogNewHU) {
				this.oDialogNewHU = sap.ui.xmlfragment("com.erpis.shiperp.parcel.fragment.CreateHUDialog", this);
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
			this._oHTSDialog = Utils.getFragment("", "HTSDisplayDialog", this);
			this._oHTSDialog.open();
		},

		onCloseHTSDialog: function () {
			this._oHTSDialog.close();
		},

		onCheckBreakBulk: function (oEvent) {
			this._checkBreakBulk();
		},

		onOpenHUItemsDialog: function (oEvent) {
			var oObject = oEvent.getSource().getBindingContext("local").getObject();
			this.getModel("local").setProperty("/FreightunitItems", oObject.FreightunitItems.results);
			if (!this._oHUItemsDialog) {
				this._oHUItemsDialog = sap.ui.xmlfragment("com.erpis.shiperp.parcel.fragment.packing.HUItemsDialog", this);
				this.getView().addDependent(this._oHUItemsDialog);
			}
			this._oHUItemsDialog.open();
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
					} else {
						this.getModel("local").setProperty("/basic/shipment_flags/domestic", true);
					}
					this._displayTabs();
					if (sRegionId) {
						this._updateRegion(sRegionId, sCountryCode);
					}
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
					if (oData) {
						this.getModel("local").setProperty("/basic/international", oData.GetINTL);
					} else {
						this.getModel("local").setProperty("/basic/international", {});
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
			var aTextDelivery = [];
			var aDelivery = this.byId("txtId").getTokens();
			var sLength = aDelivery.length;
			for (var i = 0; i < sLength; i++) {
				var sDel = this.byId("txtId").getTokens()[i].getText();
				aTextDelivery.push(sDel);
			}
			var sDelivery = aTextDelivery.toString();
			var sCarrier = this.byId("cbCarrier").getSelectedKey();
			var sCountry = this.byId("cbShipToCountry").getSelectedKey();
			var oData = {
				Delivery: sDelivery,
				Carrier: sCarrier,
				Country: sCountry
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
			this.sCarrier = oEvent.getSource().getSelectedKey();
			// Update basic node from new carrier
			this._changeCarrier("");
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
			setTimeout(this._resetData.bind(this), 1000);
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
			if (sap.ui.getCore().byId("tableRates").getSelectedItem() == null) {
				MessageBox.error(this.oBundle.getText("SelectItemToContinue"));
				return;
			}
			if (!this.oRatePricingDialog) {
				this.oRatePricingDialog = sap.ui.xmlfragment("com.erpis.shiperp.parcel.fragment.RatePricingsDialog", this);
				this.getView().addDependent(this.oRatePricingDialog);
			}
			var oObject = sap.ui.getCore().byId("tableRates").getSelectedItem().getBindingContext("local").getObject();
			var oRatePricingTemplate = sap.ui.xmlfragment("com.erpis.shiperp.parcel.fragment.RatePricingColumnListItem", this);
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
			if (sap.ui.getCore().byId("tableRates").getSelectedItem() == null) {
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
			if (sap.ui.getCore().byId("tableRates").getSelectedItem() == null) {
				MessageBox.error(this.oBundle.getText("SelectItemToContinue"));
				return;
			}
			if (!this.oRateDetailDialog) {
				this.oRateDetailDialog = sap.ui.xmlfragment("com.erpis.shiperp.parcel.fragment.RateDetailsDialog", this);
				this.getView().addDependent(this.oRateDetailDialog);
			}
			var oObject = sap.ui.getCore().byId("tableRates").getSelectedItem().getBindingContext("local").getObject();
			var oRateDetailTemplate = sap.ui.xmlfragment("com.erpis.shiperp.parcel.fragment.RateDetailColumnListItem", this);
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
			if (sap.ui.getCore().byId("tableRates").getSelectedItem() == null) {
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

		onChangeScaleOption: function () {
			if (this.getModel("local").getProperty("/UseScale") === "0001") {
				this._getExternalScale();
			} else if (this.getModel("local").getProperty("/UseScale") === "0002") {
				this._refreshPackingData(true);
				this.enableEditFreightUnits(false);
				this.getModel("local").setProperty("/aFreightUnitEdits", []);
			} else if (this.getModel("local").getProperty("/UseScale") === "0003") {
				this.enableEditFreightUnits(true);
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
				this.oSerialDialog = sap.ui.xmlfragment("com.erpis.shiperp.parcel.fragment.SerialDialog", this);
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

		onValidateAddressPress: function () {
			var oRequestData = this._generateValidateAddressUsecase();
			this.showBusy();
			this.getModel().create("/ShipmentQuerySet", oRequestData, {
				success: function (oData) {
					var oNewAddress = oData.basic.partners.shipto;
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
				} else if (this.getModel("local").getProperty("/UseScale") === "0002") {
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
						oButton.setPressed(!oButton.getPressed());
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
			// This block is used to update the shipping status and disable Execute buttons
			this._updateShippingStatus();
		},

		onReupdateItemScalePress: function (oEvent) {
			var oObject = oEvent.getSource().getBindingContext("local").getObject();
			var sWeight = oObject.weight;
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
						this.hideBusy();
					}.bind(this),
					error: function (oError) {
						this._handleODataError(oError);
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
			}
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
				if (oSelectedHu.getBindingContext("local").getObject().FreightunitHazmat.results.length > 0) {
					oSelectedHu.setHighlight("Error");
					oSelectedHu.setTooltip(this.oBundle.getText("hazmatNotMaintainedTooltip"));
				} else {
					oSelectedHu.setHighlight("None");
					oSelectedHu.setTooltip("");
				}
			} else {
				if (oSelectedHu.getBindingContext("local").getObject().FreightunitHazmat.length > 0) {
					oSelectedHu.setHighlight("Error");
					oSelectedHu.setTooltip(this.oBundle.getText("hazmatNotMaintainedTooltip"));
				} else {
					oSelectedHu.setHighlight("None");
					oSelectedHu.setTooltip("");
				}
			}

			delete this.mFreightUnitHazmatItems[sKey];
			this.oHazmatDialog.close();
		},

		onHazmatUpdatePress: function () {
			var oBinding = this.byId(this.getView().createId("hazmatDetailContainer")).getBindingContext("local");
			if (!oBinding) {
				// no data selected
				return;
			}
			this._validateHazmat();
		},

		onHazmatContinuePress: function () {
			this._validateAllHazmat();
		},

		onHazmatSelectedChangePress: function (oEvent) {
			var oControl = oEvent.getSource();
			var oBinding = oControl.getBindingContext("local");
			var oData = oBinding.getObject();
			if (oControl.getSelected()) {
				oData.Selected = "X";
			} else {
				oData.Selected = "";
			}
			this.getModel("local").setProperty(oBinding.getPath(), oData);
		},

		onDotIDNumberLinkPress: function (oEvent) {
			var oControl = oEvent.getSource();
			var oView = this.getView();
			var oBindingData = oControl.getBindingContext("local").getObject();

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
			this.showBusy();
			this.getModel().callFunction("/GetSingleHazmat", {
				urlParameters: {
					HazmatID: sKey
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
			var oReprintTemplate = sap.ui.xmlfragment("com.erpis.shiperp.parcel.fragment.ReprintColumnListItem", this);
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
								sPath = this.getModel().sServiceUrl + "/ShipmentLabelSet(shipmentid='',Guid='" + oData.results[i].Guid +
									"')/$value";
								sap.m.URLHelper.redirect(sPath, true);
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
			var xnavservice = sap.ushell && sap.ushell.Container && sap.ushell.Container.getService && sap.ushell.Container.getService(
				"CrossApplicationNavigation");
			xnavservice.toExternal({
				target: {
					shellHash: shellHash
				}
			});
		},

		onPrepaidSelect: function (oEvent) {
			var bChecked = oEvent.getParameter("selected");
			this.getModel("local").setProperty("/basic/payment/ppaid_add", bChecked);
		},

		onOpenAdvancedPackingDialog: function () {
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

			this._refreshPackingData();
		},

		onCloseAdvancedPackingDialog: function () {
			this.oAdvancedPackingDialog.close();
		},

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
					"com.erpis.shiperp.parcel.fragment.carrier.FedExGroundHoldAtLocationDetailDialog",
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
					"com.erpis.shiperp.parcel.fragment.carrier.FedExHoldAtLocationDetailDialog",
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
					"com.erpis.shiperp.parcel.fragment.carrier.FedExGroundCODRecipientDetailDialog",
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
					"com.erpis.shiperp.parcel.fragment.carrier.FedExCODRecipientDetailDialog",
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
						this.oRateAnalysisDialog = sap.ui.xmlfragment("com.erpis.shiperp.parcel.fragment.RateAnalysisDialog", this);
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
						this.oRateDialog = sap.ui.xmlfragment("com.erpis.shiperp.parcel.fragment.RatesDialog", this);
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
			var aFreightunits = this._getSelectedFreightUnits();
			var oData = {
				shipmentid: "",
				inputids: (this.sInputIDs) ? this.sInputIDs : "",
				inputtype: (this.sInputType) ? this.sInputType : "",
				profile: (this.sProfile) ? this.sProfile : "",
				shippingstation: (this.sStation) ? this.sStation : "",
				action: sActionName,
				basic: this.getModel("local").getProperty("/basic"),
				Freightunits: aFreightunits,
				HTS: this.getModel("local").getProperty("/HTS"),
				References: this.getModel("local").getProperty("/References"),
				CarrierRates: [],
				CarrierRateDetailSet: [],
				CarrierRatePricingSet: [],
				CarrierRateErrors: [],
				CarrierRateAnalysisSet: [],
				RateFreightUnits: []
			};
			return oData;
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
					this.oHUTable.removeSelections();
					// select next HU item if execute successfully.
					this._selectNextItem();
					//Hooks in Standard Controller for making controller extension
					if (this.afterGetTwoTable) {
						this.afterGetTwoTable(oData);
					}
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

			var oData = {
				shipmentid: this.getModel("local").getProperty("/UseScale"),
				inputids: (this.sInputIDs) ? this.sInputIDs : "",
				inputtype: (this.sInputType) ? this.sInputType : "",
				profile: (this.sProfile) ? this.sProfile : "",
				shippingstation: (this.sStation) ? this.sStation : "",
				action: sActionName,
				basic: this.getModel("local").getProperty("/basic"),
				Freightunits: [{
					FreightunitItems: [],
					FreightunitHazmat: []
				}],
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
					if (oData) {
						this.getModel("local").setProperty("/OrientationsSet", oData.OrientationsSet.results);
					} else {
						this.getModel("local").setProperty("/OrientationsSet", []);
					}

					if (oData.basic.carrier_data.carrier === "FDXE") {
						this._bindEmptyPickupReadyTimeFDXE();
					} else if (oData.basic.carrier_data.carrier === "FDXG") {
						this._bindEmptyPickupReadyTimeFDXG();
					}

					this._displayTabs();
					// Filter all the available dropdowns
					this._filterAllDropdowns();
					// display message strip header.
					this._displayMessageStripHeader();
					// used to reupdate service id when selecting rate entry from the rate dialog
					if (this.sService !== "") {
						this.getModel("local").setProperty("/basic/carrier_data/service", this.sService);
						this.sService = "";
					}
					this.hideBusy();
				}.bind(this),
				error: function (oError) {
					this._handleODataError(oError);
					this.hideBusy();
				}.bind(this)
			});
		},

		_generateChangeCarrierUsecase: function () {
			var oData = {
				shipmentid: "",
				inputids: (this.sInputIDs) ? this.sInputIDs : "",
				inputtype: (this.sInputType) ? this.sInputType : "",
				profile: (this.sProfile) ? this.sProfile : "",
				shippingstation: (this.sStation) ? this.sStation : "",
				action: "ChangeCarrier",
				basic: this.getModel("local").getProperty("/basic"),
				References: this.getModel("local").getProperty("/References"),
				OrientationsSet: this.getModel("local").getProperty("/OrientationsSet"),
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

		_execute: function (sActionName) {
			var oRequestData = this._generateExecuteUsecase(sActionName);
			var oHUTab = this.oHUTable;
			var sMps = this.getModel("local").getProperty("/basic/carrier_data/mps/mps");
			var sMpsType = this.getModel("local").getProperty("/basic/carrier_data/mps/mpstype");
			if (!(sMps === "X" && sMpsType === "02")) { // is single
				this.oSelectedHu = oHUTab.getSelectedItem();
			}
			this.showBusy();
			this.getModel().create("/ShipmentQuerySet", oRequestData, {
				success: function (oData, oResponse) {
					this._refreshPackingData();
					var oBasicData = this.getModel("local").getProperty("/basic");
					// Tracking Data
					var oTracking = {};
					if (oData.ShipmentTrackingsSet.results.length > 0) {
						oTracking = oData.ShipmentTrackingsSet.results[oData.ShipmentTrackingsSet.results.length - 1];
					}
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
					// Print Shipment Labels
					if (oData.ShipmentLabelSet) {
						if (oData.ShipmentLabelSet.results.length === 0) {
							MessageBox.error(this.oBundle.getText("NoPrintPreview"));
						} else {
							var sPath;
							for (var i = 0; i < oData.ShipmentLabelSet.results.length; i++) {
								sPath = this.getModel().sServiceUrl + "/ShipmentLabelSet(shipmentid='',Guid='" + oData.ShipmentLabelSet.results[i].Guid +
									"')/$value";
								sap.m.URLHelper.redirect(sPath, true);
							}
						}
					}

					MessageToast.show(this.oBundle.getText("ExecuteSuccess", [oTracking.mastertrack]));
					this.getModel("local").setProperty("/PreviousShipment", oPreviousShipment);

					this._handleOdataResponse(oResponse);
				}.bind(this),
				error: function (oError) {
					this.oSelectedHu = null;
					this._handleODataError(oError);
					this.hideBusy();
				}.bind(this)
			});
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

		_generateExecuteUsecase: function (sActionName) {
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
			var oData = {
				shipmentid: "",
				inputids: (this.sInputIDs) ? this.sInputIDs : "",
				inputtype: (this.sInputType) ? this.sInputType : "",
				profile: (this.sProfile) ? this.sProfile : "",
				shippingstation: (this.sStation) ? this.sStation : "",
				action: sActionName,
				basic: this.getModel("local").getProperty("/basic"),
				Freightunits: aFreightUnits,
				HTS: this.getModel("local").getProperty("/HTS"),
				References: this.getModel("local").getProperty("/References"),
				ShipmentTrackingsSet: [],
				ShipmentLabelSet: [],
				NaftaDetailSet: this.getModel("local").getProperty("/NaftaDetailSet")
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
			if (!this.getModel("local").getProperty("/basic/shipment_flags/domestic")) {
				// Filter the Importer Region Dropdown based on Country
				var oImporterStateSel = this.byId("slImporterState");
				oImporterStateSel.getBinding("items").filter(new Filter("Country", "EQ", this.getModel("local").getProperty(
					"/basic/partners/importer/address/country")));
				oImporterStateSel.getBinding("items").attachDataReceived(function () {
					oImporterStateSel.setSelectedKey(this.getModel("local").getProperty("/basic/partners/importer/address/state"));
				}.bind(this), this);

				// Carrier specific international controls
				if (this.sCarrier === "FDXE" || this.sCarrier === "FDXG") {
					// FedEx internation state filter
					var oFedExInternationalStateSel = this.byId("slFedExInternationalState");
					oFedExInternationalStateSel.getBinding("items").filter(new Filter("Country", "EQ", this.getModel("local").getProperty(
						"/basic/international/customs_broker/brokercountry")));
					oFedExInternationalStateSel.getBinding("items").attachDataReceived(function () {
						oFedExInternationalStateSel.setSelectedKey(this.getModel("local").getProperty(
							"/basic/international/customs_broker/brokerstate"));
					}.bind(this), this);

					this.byId("cbFedExTermOfSale").getBinding("items").filter(new Filter("Carrier", "EQ", this.sCarrier));
					this.byId("cbFedExSalePurpose").getBinding("items").filter(new Filter("Carrier", "EQ", this.sCarrier));
					this.byId("cbFedExRegulatoryControl").getBinding("items").filter(new Filter("Carrier", "EQ", this.sCarrier));
					this.byId("cbFedExTinType").getBinding("items").filter(new Filter("Carrier", "EQ", this.sCarrier));
					this.byId("cbBrokerTinType").getBinding("items").filter(new Filter("Carrier", "EQ", this.sCarrier));
					this.byId("cbStatementType").getBinding("items").filter(new Filter("Carrier", "EQ", this.sCarrier));
				} else if (this.sCarrier === "UPS") {
					this.byId("cbUPSTermOfSale").getBinding("items").filter(new Filter("Carrier", "EQ", this.sCarrier));
					this.byId("cbUPSSalePurpose").getBinding("items").filter(new Filter("Carrier", "EQ", this.sCarrier));
					this.byId("cbUPSRegulatoryControl").getBinding("items").filter(new Filter("Carrier", "EQ", this.sCarrier));
					this.byId("cbUPSTinType").getBinding("items").filter(new Filter("Carrier", "EQ", this.sCarrier));
				}
			}
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

			// Carrier specific Tab
			this.byId("iconTabCarrier").setVisible(true);
			this.byId("iconTabCarrierSub").setTitle(this.getModel("local").getProperty("/basic/carrier_data/CarrierName"));
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
				CarrierRates: []
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
			var oData = this.getModel("local").getProperty("/Freightunits");
			if (oData) {
				var bCanShip = false;
				for (var i = 0; i < oData.length; i++) {
					if (oData[i].trackingnumber === "") {
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
				return;
			}
			this.showBusy();
			var oRequestData = this._generateHazardousUsecase();
			this.getModel().create("/ShipmentQuerySet", oRequestData, {
				success: function (oData) {
					var aResults = oData.Freightunits.results[0].FreightunitHazmat.results;
					this.getModel("local").setProperty("/FreightunitHazmats", aResults);
					this.mFreightUnitHazmatItems[sKey] = aResults;
					this.oHazmatDialog = Utils.getFragment("", "HazmatDialog", this);
					this.oHazmatDialog.open();
					this.hideBusy();
				}.bind(this),
				error: function (oError) {
					this._handleODataError(oError);
					this.hideBusy();
				}.bind(this)
			});
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

		_generateHazardousUsecase: function () {
			var aFreightUnits = this._getSelectedFreightUnits();
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
			var oHazmat = this.byId(this.getView().createId("hazmatDetailContainer")).getBindingContext("local").getObject();
			if (!oHazmat) {
				return null;
			}
			aFreightUnits[0].FreightunitHazmat = [oHazmat];
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

		treeify: function (list, idAttr, parentAttr, childrenAttr) {
			if (!idAttr) idAttr = 'NodeId';
			if (!parentAttr) parentAttr = 'HeirLvl';
			if (!childrenAttr) childrenAttr = 'Children';

			var treeList = [];
			var lookup = {};
			list.forEach(function (obj) {
				lookup[obj[idAttr]] = obj;
				obj[childrenAttr] = [];
			});
			list.forEach(function (obj) {
				if (obj[parentAttr] !== 0) {
					lookup[obj[parentAttr]][childrenAttr].push(obj);
				} else {
					treeList.push(obj);
				}
			});
			return treeList;
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
			var oRequestData = this._generateBreakBulkUsecase();
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

		_generateBreakBulkUsecase: function () {
			var oData = {
				shipmentid: "",
				inputids: (this.sInputIDs) ? this.sInputIDs : "",
				inputtype: (this.sInputType) ? this.sInputType : "",
				profile: (this.sProfile) ? this.sProfile : "",
				shippingstation: (this.sStation) ? this.sStation : "",
				action: "UpdateBreakBulk",
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

		_showPackingOverview: function (sHU) {
			this.showBusy();
			this.getModel().callFunction("/ShowPackingOverview", {
				urlParameters: {
					object: this.sObject,
					objectkey: this.sObjectKey
				},
				success: function (oData) {
					this.hideBusy();
					var aTempOutput = [];
					var aOutput = [];
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
			var aSelectedHUs = this.oHUTable.getItems();
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
									aHUs[j].weight = parseFloat(oData.GetExternalScale.Weight).toFixed(2);
									this.iOriginalExtScaleWeight = aHUs[j].weight;
									aHUs[j].weight_unit = oData.GetExternalScale.WeightUnit;
									this.sOriginalExtScaleWeightUnit = oData.GetExternalScale.WeightUnit;
								}
							}
						}
						this.getModel("local").setProperty("/Freightunits", aHUs);
						this.getModel("local").setProperty("/aFreightUnitEdits", []);
						this.enableEditFreightUnitsforExternalScale(false);
					}
					this.hideBusy();
				}.bind(this),
				error: function (oError) {
					this.getModel("local").setProperty("/aFreightUnitEdits", []);
					this.enableEditFreightUnitsforExternalScale(false);
					this._handleODataError(oError);
					this.hideBusy();
				}.bind(this)
			});
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
		}

	});
});