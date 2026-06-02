/*global location*/
jQuery.sap.require("com.erpis.shiperp.hr7.parcelewm.common.jquery_hotkeys");
sap.ui.define([
	"com/erpis/shiperp/hr7/parcelewm/controller/BaseController",
	"sap/ui/model/json/JSONModel",
	"com/erpis/shiperp/hr7/parcelewm/model/formatter",
	"sap/m/Token",
	"sap/ui/model/Filter",
	"sap/m/MessageBox",
	"sap/m/MessageToast",
	"com/erpis/shiperp/hr7/parcelewm/common/Utils",
	"com/erpis/shiperp/hr7/parcelewm/common/hotkeyInterface",
	"com/erpis/shiperp/hr7/parcelewm/common/DynamicView",
	"com/erpis/shiperp/hr7/parcelewm/common/UploadUtils",
	"com/erpis/shiperp/hr7/parcelewm/common/HttpHelper",
	"sap/ui/core/library"

], function (BaseController, JSONModel, formatter, Token, Filter, MessageBox, MessageToast, Utils, HotkeyInterface, DynamicView,
	UploadUtils, HttpHelper, library) {
	"use strict";

	var MessageType = library.MessageType;

	return BaseController.extend("com.erpis.shiperp.hr7.parcelewm.controller.Main", {

		oLogger: jQuery.sap.log.getLogger("com.erpis.shiperp.hr7.parcelewm.controller.Main"),
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
		bcheckHazmatupdate: false, // Check hazmat updated the Hazardous Material.
		oUpdateHazatdata: {},
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

			/** add checkbox validator **/
			this.getView().byId("txtId").addValidator(function (args) {
				var text = args.text;
				return new Token({
					key: text,
					text: text
				});
			});

			/*  Initialize Message Model */
			var oJSONModel = new JSONModel({
				aMessages: [],
				messagesLength: 0
			});
			this.setModel(oJSONModel, "messageModel");

			/*  hot key */
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

			this.sWarehouseNumber = oEvent.getParameter("arguments").WarehouseNumber;

			this.byId("cbInputType").getBinding("items").filter(new Filter("Shipping", "EQ", true));
			// Register event load for combobox input type
			this.byId("cbInputType").getBinding("items").attachDataReceived(this.onInputTypeLoaded(), this);
			var comboBox = this.byId("cbInputType");
			// Set default value
			this.getOwnerComponent().getModel().read("/xSERPERPxI_PACKSET('" + this.sProfile + "')", {
				success: function (res) {
					//Get default value amd set selected key for cbInputType
					comboBox.setSelectedKey(res.ShipTypeInput);
				}
			});

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

		/* When dropdown input type loaded */
		onInputTypeLoaded: function () {
			this.oInputTypeDeferred.resolve();
		},

		onInputTypeChange: function (oEvent) {
			this.onResetData();
		},

		/** Enter press on the search text on the header toolbar **/
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
			/* check indicator */
			this.indicator = "";
			this.idnumber = "";
			this.checkparcelapp = "P";
			this.aConsolidation = [];
			if (oEvent.getSource().getTokens().length > 0) {
				for (var i = 0; i < oEvent.getSource().getTokens().length; i++) {
					var sTokenValue = oEvent.getSource().getTokens()[i].getText();
					this.sInputIDs += sTokenValue + "|";
					this.aConsolidation.push({
						Docno: sTokenValue,
						Doctype: this.sInputType,
						Updkz: ""
					});
				}
				this.sInputIDs += oEvent.getSource().getValue();
				this.aConsolidation.push({
					Docno: oEvent.getSource().getValue(),
					Doctype: this.sInputType,
					Updkz: ""
				});
			} else {
				this.sInputIDs = oEvent.getSource().getValue();
				this.aConsolidation.push({
					Docno: oEvent.getSource().getValue(),
					Doctype: this.sInputType,
					Updkz: ""
				});
			}
			this.showBusy();
			this.getModel().read("/ShipmentQuerySet", {
				filters: [
					new Filter("transaction_class", "EQ", this.checkparcelapp),
					new Filter("inputtype", "EQ", this.sInputType),
					new Filter("inputids", "EQ", this.sInputIDs),
					new Filter("profile", "EQ", this.sProfile),
					new Filter("shippingstation", "EQ", this.sStation),
					new Filter("warehousenum", "EQ", this.sWarehouseNumber)
				],
				urlParameters: {
					"$expand": "carrierMoreOption/valueList,SerialSet,SerialSet/SerialItemSet,HTS,HandlingUnits/carrierMoreOption/valueList,References,CarrierList,ServiceList,Contents,NaftaDetailSet,OrientationsSet,return,hazmat_err_hu,internationalMoreOption,HandlingUnitItemLists/HandlingUnitItems,HandlingUnitPackDetails"
				},
				success: function (oData) {
					this.hideBusy();
					if (oData.results.length !== 0) {
						this.bError = false;
						var oResults = oData.results[0];
						if (oResults.return.results.length > 0) {
							var aMsg = this._generateMessages(oResults.return.results);
							this._addMessage(aMsg);
							this.bError = true;
							MessageBox.warning(oResults.return.results[0].Message, {
								title: "Warning",
								actions: sap.m.MessageBox.Action.CLOSE,
								onClose: function () {
									this._processScanInput(oResults);
								}.bind(this)
							}).bind(this);
							return;
						}
						this._processScanInput(oResults);
					} else {
						MessageBox.warning(this.oBundle.getText("NoDataFound"));
						// Enable inputs fields
						this.byId("txtId").setEditable(true);
						this.byId("cbInputType").setEnabled(true);
					}
				}.bind(this),
				error: function (oError) {
					/** reset view **/
					this.byId("txtId").setEditable(true);
					this.byId("cbInputType").setEnabled(true);
					this.getModel("local").setData({});
					this._handleODataError(oError);
					this.hideBusy();
				}.bind(this)
			});
		},

		_processScanInput: function (oData) {
			this.getModel("local").setProperty("/ShipmentCarrierOptions", oData.carrierMoreOption.results);
			this.getModel("local").setProperty("/Contents", oData.Contents.results);
			this.getModel("local").setProperty("/FreightunitHeaders", []);
			this.getModel("local").setProperty("/HTS", oData.HTS.results);
			this.getModel("local").setProperty("/References", oData.References.results);
			this.getModel("local").setProperty("/CarrierList", oData.CarrierList.results);
			this.getModel("local").setProperty("/ServiceList", oData.ServiceList.results);
			this.getModel("local").setProperty("/NaftaDetailSet", oData.NaftaDetailSet.results);
			this.getModel("local").setProperty("/basic", oData.basic);
			this.getModel("local").setProperty("/OrientationsSet", oData.OrientationsSet.results);
			this.getModel("local").setProperty("/HandlingUnitLists", oData.HandlingUnits.results);
			if (oData.Party_Ids.It_Ids) {
				this.getModel("local").setProperty("/Identifications", oData.Party_Ids.It_Ids.results);
			};
			this.getModel("local").setProperty("/ShipmentContans", oData.HandlingUnitPackDetails.results);
			this.getModel("local").setProperty("/MessageDetail", oData.return.results);
			/** construct serial list **/
			this.getModel("local").setProperty("/MasterSerialList", oData.SerialSet.results);
			this.aOriginMasterSerialList = jQuery.extend(true, [], oData.SerialSet.results);

			/** Keep the common properties at controller state **/
			this.sObject = this.getModel("local").getProperty("/basic/hu_object/Object");
			this.sObjectKey = this.getModel("local").getProperty("/basic/hu_object/ObjectKey");
			this.sCarrier = oData.basic.carrier_data.carrier;
			this.bCheckShipmentComplete = false;
			this.getModel("local").setProperty("/Header", {
				ServiceName: "",
				ShipToCountry: "",
				ShipToState: "",
				BillingOption: "",
				TPCountry: ""
			});

			/** Show header content **/
			this.byId("ObjectPageLayout").setShowHeaderContent(true);
			this.byId("ObjectPageLayout").setPreserveHeaderStateOnScroll(true);

			/** Handle hazmat **/
			if (oData.hazmat_err_hu && oData.hazmat_err_hu.results.length > 0) {
				var output_Hu = oData.hazmat_err_hu.results.reduce(function (acc, obj) {
					var key = obj.freightunitkey;
					var existingObj = acc.find(function (item) {
						return item.information === key;
					});
					if (existingObj) {
						existingObj.results.push(obj);
					} else {
						acc.push({
							information: key,
							results: [{
								information: "Imcompatible DG Class/subclass 1",
								results: [obj]
							}]
						});
					}
					return acc;
				}, []);
				this.getModel("local").setProperty("/BindingHu", output_Hu);
				//handle hazmat_err_ship
				var originalArrayship = oData.hazmat_err_ship.results;
				var icount = 1;
				var output_ship = originalArrayship.reduce(function (acc, obj, idex) {
					var key = obj.item;
					var existingObj = acc.find(function (items) {
						var existing = items.results.find(function (itemhu) {
							return itemhu.item === key;
						});
						return existing;
					});
					if (existingObj) {
						existingObj.results.push(obj);
					} else {
						acc.push({
							information: "Imcompatible DG Class/subclass " + icount,
							results: [obj]
						});
						icount++;
					}
					return acc;
				}, []);
				this.getModel("local").setProperty("/BindingByShipment", output_ship);
				if (!this.ohazmaterrhuDialog) {
					this.ohazmaterrhuDialog = sap.ui.xmlfragment("com.erpis.shiperp.hr7.parcelewm.fragment.Shipmentcontainshazmat", this);
					this.getView().addDependent(this.ohazmaterrhuDialog);
				}
				this.ohazmaterrhuDialog.open();
			}
			/* Set message return */
			if (oData.return && oData.return.results.length > 0) {
				var aMsg = this._generateMessages(oData.return.results);
				this._addMessage(aMsg);
			}
			/* Set international options */
			if (oData.internationalMoreOption.results.length > 0) {
				this.getModel("local").setProperty("/Internationaloptions", oData.internationalMoreOption.results);
				this._displayShipmentInternationOprionTab();
			}
			/* check shipment flags */
			if (oData.basic.shipment_flags) {
				this.getModel("local").setProperty("/basic/shipment_flags/hazmatflag", oData.basic.shipment_flags.hazmatflag);
			}
			/* Set Carrier Options */
			if (oData.carrierMoreOption && oData.carrierMoreOption.results) {
				var aDataFixed = this._checkDuplicateObjInArr(oData.carrierMoreOption.results, "object_name");
				this.getModel("local").setProperty("/ShipmentCarrierOptions", aDataFixed);
			}
			/* refesh hazmat */
			this.getModel("local").setProperty("/refreshHUS", oData.HandlingUnits.results);
			/* display message strip header. */
			this._displayMessageStripHeader();
			/* Set handling unit items */
			if (oData.HandlingUnitItemLists) {
				this.getModel("local").setProperty("/HUItemsList", oData.HandlingUnitItemLists.results);
			} else {
				this.getModel("local").setProperty("/HUItems", []);
			}
			/* Set handling unit pack details */
			if (oData.HandlingUnitPackDetails) {
				this.getModel("local").setProperty("/HUPackDetails", oData.HandlingUnitPackDetails.results);
			} else {
				this.getModel("local").setProperty("/HUPackDetails", []);
			}

			/* Set Flag hazmat */
			this.bcheckHazmatupdate = false;
			/* Refresh data */
			this._refreshData();
			/* Enable object page section */
			this._displayTabs();
			/* Filter all the available dropdowns */
			this._filterAllDropdowns();
			/* Handle Handling units */
			this._handleHUList();
			/* Dynamic form object page section */
			this.oContentTable.removeSelections();
			this.oHUTable.removeSelections();
			this._updateShippingAndCarrMoreOpt(this.bError);
			/* Set Use scale */
			this.getModel("local").setProperty("/UseScale", oData.option);
			/** check auto ship **/
			if (oData.autoship.trim() === 'X') {
				this.getModel("local").setProperty("/tickautoship", true);
				this._processAutoCheck().done(function () {}).always(function () {
					this.hideBusy();
				});
			}
			/** Disable inputs fields **/
			this.byId("txtId").setEditable(false);
			this.byId("cbInputType").setEnabled(false);
			this.hideBusy();
		},
		_processAutoCheck: function () {
			var oDeferredAuto = $.Deferred();
			var oRequestData = this._generateUsecaseautoship("AutoShip");
			this.showBusy();
			this.getModel().create("/ShipmentQuerySet", oRequestData, {
				success: function (oData) {
					// Handle display message
					this.bError = false;
					var bHasErrorMessCheck = false;
					if (oData.return.results.length > 0) {
						var aMsg = this._generateMessages(oData.return.results);
						this._addMessage(aMsg);
						for (var i = 0; i < aMsg.length; i++) {
							if (aMsg[i].type == "E") {
								bHasErrorMessCheck = true;
							}
						}
						if (aMsg.length > 0) this.byId('popoverButton').firePress();
					}

					var oTracking = {};
					if (oData.ShipmentReturnSet.results.length > 0) {
						oTracking = oData.ShipmentReturnSet.results[oData.ShipmentReturnSet.results.length - 1];
					}
					if (parseInt(oTracking.Mastertrack, 10) > 0) {
						MessageToast.show(this.oBundle.getText("ExecuteSuccess", [oTracking.Mastertrack]));
					}
					// Handle update HU
					if (oData.HandlingUnits) {
						this.getModel("local").setProperty("/HandlingUnitLists", oData.HandlingUnits.results);
					}
					this._handleHUList();
					this._updateShippingAndCarrMoreOpt(this.bError);
					//Hadle Shipment Label
					if (oData.ShipmentLabelSet.results.length > 0) {
						var contentType;
						var blob;
						var fileURL;
						if (oData.ShipmentLabelSet.results.length === 0) {
							MessageBox.error(this.oBundle.getText("NoPrintPreview"));
						}
						for (var b = 0; b < oData.ShipmentLabelSet.results.length; b++) {
							var shipmentLabelItem = oData.ShipmentLabelSet.results[b];
							if (shipmentLabelItem.OutputType === "PDF") {
								MessageToast.show(this.oBundle.getText("PrintSuccess"));
								var binary = atob(shipmentLabelItem.Output_Data.replace(/\s/g, ''));
								var view = new Uint8Array(new ArrayBuffer(binary.length));
								for (var i = 0; i < binary.length; i++) {
									view[i] = binary.charCodeAt(i);
								}
								blob = new Blob([view], {
									type: "application/pdf"
								});
								var url = URL.createObjectURL(blob);
								window.open(url);
							} else if (shipmentLabelItem.OutputType === "GIF") {
								MessageToast.show(this.oBundle.getText("PrintSuccess"));
								contentType = 'image/gif';
								blob = this.b64toBlob(shipmentLabelItem.Output_Data, contentType);
								fileURL = URL.createObjectURL(blob);
								window.open(fileURL);
							}
						}
						this.hideBusy();
					}
					oDeferredAuto.resolve(oData);
					this.hideBusy();
				}.bind(this),
				error: function (oError) {
					this._handleODataError(oError);
					oDeferredAuto.reject(oError);
					this.hideBusy();
				}.bind(this)
			});
			return oDeferredAuto.promise();
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
						return item.object_name === key && item.valueList.results.length > 0;
					});
					for (var j = 0; j < aSource.length; j++) {
						if (aSource[j].object_name === key && aSource[j].valueList.results.length === 0) {
							aSource[j].valueList = found.valueList;
						}
					}
				}
			}
			return aSource;
		},

		onCloseHazmatMaterial: function () {
			this.ohazmaterrhuDialog.close();
		},
		onCloseReportHazmatDetail: function () {
			this.onOpenReport.close();
		},

		onDisplayReport: function () {
			if (!this.onOpenReport) {
				this.onOpenReport = sap.ui.xmlfragment("com.erpis.shiperp.hr7.parcelewm.fragment.ReportHazmatMaterial", this);
				this.getView().addDependent(this.onOpenReport);
			}
			this.onOpenReport.open();
		},

		_handleHUList: function () {
			var aHUList = this.getModel("local").getProperty("/HandlingUnitLists");
			var aHUItemsList = this.getModel("local").getProperty("/HUItemsList");
			if (aHUList && aHUItemsList) {
				aHUList.forEach(function (oHU) {
					aHUItemsList.forEach(function (oItem) {
						if (parseInt(oHU.Outbhu, 10) === parseInt(oItem.huident, 10)) {
							oHU.HandlingUnitItems = oItem.HandlingUnitItems;
						}
					});
				});
			}
		},

		getFreightUnitExt: function () {
			this.showBusy();
			var oDeferred = $.Deferred();
			var oRequestData = this._generateGetFreightUnitExtUsecase();
			this.getModel().create("/ShipmentQuerySet", oRequestData, {
				success: function (oData) {
					this.hideBusy();
					if (oData.return && oData.return.results.length > 0) {
						var aMsg = this._generateMessages(oData.return.results);
						this._addMessage(aMsg);
					}
					if (oData.HandlingUnits) {
						this.getModel("local").setProperty("/HandlingUnitLists", oData.HandlingUnits.results);
					}
					oDeferred.resolve();
				}.bind(this),
				error: function (oError) {
					this.hideBusy();
					this._handleODataError(oError);
					oDeferred.resolve();
				}.bind(this)
			});
			return oDeferred;
		},

		_generateGetFreightUnitExtUsecase: function () {
			var oData = {
				inputtype: (this.sInputType) ? this.sInputType : "",
				inputids: (this.sInputIDs) ? this.sInputIDs : "",
				shippingstation: (this.sStation) ? this.sStation : "",
				profile: (this.sProfile) ? this.sProfile : "",
				warehousenum: (this.sWarehouseNumber) ? this.sWarehouseNumber : "",
				action: "GetFreightUnitExt",
				return: [],
				carrierMoreOption: [{
					valueList: []
				}],
			};
			return oData;
		},

		onSelectionChange: function (oEvent) {
			var aSelected = oEvent.getSource().getSelectedItems();
			var aSelectedKeys = aSelected.map(function (oItem) {
				return oItem.getBindingContext("local").getObject().Outbhu;
			});
			var aHUs = this.getModel("local").getProperty("/HandlingUnitLists");
			aHUs.forEach(function (oHU) {
				oHU.Sel = aSelectedKeys.includes(oHU.Outbhu) ? 'X' : '';
			});
			this.getModel("local").setProperty("/HandlingUnitLists", aHUs);
		},

		// Add Default HU section
		onAddDefaultHU: function () {
			if (!this.oDialogDefaultHU) {
				this.oDialogDefaultHU = sap.ui.xmlfragment("com.erpis.shiperp.hr7.parcelewm.fragment.CreateDefaultHUDialog", this);
				this.getView().addDependent(this.oDialogDefaultHU);
			}
			this.oDialogDefaultHU.open();
		},

		// Add New HU section
		onAddNewHU: function () {
			this.parentPackMat = "Create";
			if (!this.oDialogNewHU) {
				this.oDialogNewHU = sap.ui.xmlfragment("com.erpis.shiperp.hr7.parcelewm.fragment.CreateHUDialog", this);
				this.getView().addDependent(this.oDialogNewHU);
			}
			this.oDialogNewHU.open();
		},

		onCreateHU: function () {
			this._createHU();
		},

		onLiveChange: function (oEvent) {
			var input = oEvent.getSource();
			input.setValue(input.getValue().toUpperCase());
		},

		onCloseNewHUDialog: function () {
			this.oDialogNewHU.close();
		},

		// Delete HU section
		onDeleteHU: function () {
			var aSelectedHUs = [];
			var bAll = false;
			var aTotalHU = this.getModel("local").getProperty("/HandlingUnitLists");
			// Get the selected HandlingUnitLists depending on the Packing scenario
			if (this._getPackingScenario() === "01") { // Main Screen Scenario
				aSelectedHUs = this.oHUTable.getSelectedItems();
			} else if (this._getPackingScenario() === "02") { // Pack by Material Dialog
				aSelectedHUs = this.oHUTable.getSelectedItems();
			} else if (this._getPackingScenario() === "03") { // Pack by HU Dialog
				aSelectedHUs = this.oHURightTable.getSelectedItems();
			} else { // Default
				aSelectedHUs = this.oHUTable.getSelectedItems();
			}
			// Validate if any HU is selected
			if (aSelectedHUs.length === 0) {
				MessageBox.error(this.oBundle.getText("SelectHUDelete"));
				return;
			}
			if (aSelectedHUs.length === aTotalHU.length) {
				bAll = true;
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
						this._deleteHUs(bAll);
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
					new Filter("shippingstation", "EQ", this.sStation),
					new Filter("warehousenum", "EQ", this.sWarehouseNumber)
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

		onOpenHUItemsDialog: function (oEvent) {
			var oObject = oEvent.getSource().getBindingContext("local").getObject();
			this.aHUPackOverView = [oObject];
			var oFreightUnit = Object.assign({}, oObject);
			//calling packing overview
			var fuKey = formatter.removeLeadingZero(oFreightUnit.Outbhu);
			var sTrackingNumber = oFreightUnit.Trackingnumber;
			this._showPackingOverview(fuKey, "06", sTrackingNumber);
		},

		onSearchMaterial: function () {
			var oFilter = new Filter("material", "Contains", this.byId("txtMaterial").getValue());
			this.oContentTable.getBinding("items").filter(oFilter);
		},

		onSearchMaterialHUItem: function () {
			var oFilter = new Filter("Matnr", "Contains", this.byId("txtMaterialHUItem").getValue());
			this.byId("tableHUItems").getBinding("items").filter(oFilter);
		},

		onValidateNumber: function (oEvent) {
			var sNewValue = oEvent.getParameter("newValue");
			var sBalance = oEvent.getSource().getBindingContext("local").getObject().Balance;
			if (parseInt(sNewValue, 10) > parseInt(sBalance, 10)) {
				oEvent.getSource().setValueState("Error");
				MessageBox.error(this.oBundle.getText("partialQuantityError"));
			} else {
				oEvent.getSource().getBindingContext("local").getObject().Partialqty = parseFloat(sNewValue, 10).toFixed(3);
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
			var CheckCountry = this.getModel("local").getProperty("/basic/partners");
			if (CheckCountry.shipfrom.address.country === sCountryCode) {
				this.getModel("local").setProperty("/basic/shipment_flags/domestic", true);
			} else {
				this.getModel("local").setProperty("/basic/shipment_flags/domestic", false);
			}
			this.showBusy();
			this._displayMessageStripHeader();
			var oRequestData = this._generateDomesticCheckUsecase();
			this.getModel().create("/ShipmentQuerySet", oRequestData, {
				success: function (oData) {
					this.hideBusy();
					this.getModel("local").setProperty("/basic/shipment_flags/domestic", oData.basic.shipment_flags.domestic);
					// check International options
					if (oData.internationalMoreOption.results.length > 0) {
						this.getModel("local").setProperty("/Internationaloptions", oData.internationalMoreOption.results);
					}
					// check importer
					this.getModel("local").setProperty("/basic", oData.basic);
					if (oData.HandlingUnits) {
						this.getModel("local").setProperty("/HandlingUnitLists", oData.HandlingUnits.results);
					}
					this._displayTabs();
					// dynamic Package Carrier Options 
					this._updateShippingAndCarrMoreOpt();
					// dynamic internationalMoreOption option
					if (!oData.basic.shipment_flags.domestic) {
						this._displayShipmentInternationOprionTab();
					}
					if (sRegionId) {
						this._updateRegion(sRegionId, sCountryCode);
					}
				}.bind(this),
				error: function (oError) {
					this._handleODataError(oError);
					this.hideBusy();
				}.bind(this)
			});
		},

		_generateDomesticCheckUsecase: function () {
			var aHandlingUnits = this.getModel("local").getProperty("/HandlingUnitLists");
			var oData = {
				shipmentid: "",
				ConsolidationSet: (this.aConsolidation) ? this.aConsolidation : [],
				inputtype: (this.sInputType) ? this.sInputType : "",
				profile: (this.sProfile) ? this.sProfile : "",
				shippingstation: (this.sStation) ? this.sStation : "",
				// carrierMoreOption: this.getModel("local").getProperty("/ShipmentCarrierOptions"),
				inputids: (this.sInputIDs) ? this.sInputIDs : "",
				warehousenum: (this.sWarehouseNumber) ? this.sWarehouseNumber : "",
				action: "DomesticCheck",
				HandlingUnits: aHandlingUnits,
				basic: this.getModel("local").getProperty("/basic"),
				internationalMoreOption: [{
					valueList: []
				}],
				return: []
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
			if (oEvent.getSource().getSelectedItem()) {
				this.sCarrier = oEvent.getSource().getSelectedItem().getKey();
				if (this.oMoreOptionDialog || this.oShipmentCarrierOptionTab) {
					var oControl = oEvent.getSource();
					MessageBox.warning(
						"Manually entered data on more options dialog will be reset once you change the carrier. Do you want to continue?", {
							actions: [sap.m.MessageBox.Action.OK, sap.m.MessageBox.Action.CANCEL],
							onClose: function (sAction) {
								if (sAction === "OK") {
									// Reset the More Option Dialog
									this.oMoreOptionDialog = null;
									//resset shipment
									if (this.oShipmentCarrierOptionTab.getBlocks()[0] instanceof sap.m.FlexBox) {
										if (this.oShipmentCarrierOptionTab.getBlocks()[0].getItems()[0] instanceof sap.m.FlexBox) {
											this.oShipmentCarrierOptionTab.getBlocks()[0].getItems()[0].removeAllContent();
										} else {
											this.oShipmentCarrierOptionTab.getBlocks()[0].getItems()[1].removeAllItems();
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
									if (this.oShipmentInternationalOptions.getBlocks()[0] instanceof sap.m.FlexBox) {
										if (this.oShipmentInternationalOptions.getBlocks()[0].getItems()[0] instanceof sap.m.FlexBox) {
											this.oShipmentInternationalOptions.getBlocks()[0].getItems()[0].removeAllContent();
										} else {
											this.oShipmentInternationalOptions.getBlocks()[0].getItems()[1].removeAllItems();
										}
									} else {
										var oCurrFormInter = this.oShipmentInternationalOptions.getBlocks()[0];
										if (oCurrFormInter) {
											oCurrFormInter.removeAllContent();
										}
									}
									this.oShipmentInternationalOptions.removeAllBlocks();
									this.oShipmentInternationalOptions = null;
									// Update basic node from new carrier
									this._changeCarrier(this.sCarrier);
								} else {
									oControl.setSelectedKey(this.sCarrier);
								}
							}.bind(this)
						}
					);
				} else {
					// Reset the More Option Dialog
					this.oMoreOptionDialog = null;
					// Update basic node from new carrier
					this._changeCarrier(this.sCarrier);
				}
			}
		},
		onServiceChange: function () {
			if (this.byId("selectService").getSelectedItem()) {
				var sService = this.byId("selectService").getSelectedItem().getKey();
				this._displayMessageStripHeader();
				this.getModel("local").setProperty("/basic/carrier_data/service", sService);
				this._changeService(sService);
			}
		},

		_changeService: function (sService) {
			this.showBusy();
			var oDeferred = $.Deferred();
			this.getModel("local").setProperty("/basic/carrier_data/service", sService);
			var oRequestData = this._generateChangeServiceUsecase();
			this.getModel().create("/ShipmentQuerySet", oRequestData, {
				success: function (oData) {
					this.hideBusy();
					if (oData.return && oData.return.results.length > 0) {
						var aMsg = this._generateMessages(oData.return.results);
						this._addMessage(aMsg);
					}
					if (oData.HandlingUnits) {
						this.getModel("local").setProperty("/HandlingUnitLists", oData.HandlingUnits.results);
					}
					this._displayTabs();
					this._updateShippingAndCarrMoreOpt();

					// Filter all the available dropdowns
					this._filterAllDropdowns();
					// display message strip header.
					this._displayMessageStripHeader();
					// used to reupdate service id when selecting rate entry from the rate dialog
					if (this.sService !== "") {
						this.getModel("local").setProperty("/basic/carrier_data/service", this.sService);
						this.sService = "";
					}
					oDeferred.resolve();
				}.bind(this),
				error: function (oError) {
					this._handleODataError(oError);
					this.hideBusy();
					oDeferred.resolve();
				}.bind(this)
			});
			return oDeferred;
		},

		_generateChangeServiceUsecase: function () {
			var aHandlingUnits = this.getModel("local").getProperty("/HandlingUnitLists");
			var oData = {
				inputids: (this.sInputIDs) ? this.sInputIDs : "",
				warehousenum: (this.sWarehouseNumber) ? this.sWarehouseNumber : "",
				action: "ChangeService",
				service: "",
				HandlingUnits: aHandlingUnits,
				basic: this.getModel("local").getProperty("/basic"),
				return: []
			};
			return oData;
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
			// var sMPSStatus = this.getModel("local").getProperty("/basic/carrier_data/mps/mps");
			var aSelectedHUs = this.oHUTable.getSelectedItems();
			var sMPSType = this.getModel("local").getProperty("/basic/carrier_data/mps/mpstype");
			if (sMPSType === "02") {
				// return true;
			} else {
				if (aSelectedHUs.length !== 1) {
					MessageBox.error(this.oBundle.getText("errorMPSSelectMsg"));
					return;
				}
			}
			this._getFreightCost("S");
		},
		onMultiRateClick: function () {
			// var sMPSStatus = this.getModel("local").getProperty("/basic/carrier_data/mps/mps");
			var aSelectedHUs = this.oHUTable.getSelectedItems();
			var sMPSType = this.getModel("local").getProperty("/basic/carrier_data/mps/mpstype");
			if (sMPSType === "02") {
				// return true;
			} else {
				if (aSelectedHUs.length !== 1) {
					MessageBox.error(this.oBundle.getText("errorMPSSelectMsg"));
					return;
				}
			}
			this._getFreightCost("M");
		},
		onRateShopClick: function () {
			var aSelectedHUs = this.oHUTable.getSelectedItems();
			var sMPSType = this.getModel("local").getProperty("/basic/carrier_data/mps/mpstype");
			if (sMPSType === "02") {
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
			var aSelectedHUs = this.oHUTable.getSelectedItems();
			var sMPSType = this.getModel("local").getProperty("/basic/carrier_data/mps/mpstype");
			if (sMPSType === "02") {
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
				this.oRatePricingDialog = sap.ui.xmlfragment("com.erpis.shiperp.hr7.parcelewm.fragment.RatePricingsDialog", this);
				this.getView().addDependent(this.oRatePricingDialog);
			}
			var oObject = sap.ui.getCore().byId("tableRates").getSelectedItem().getBindingContext("local").getObject();
			var oRatePricingTemplate = sap.ui.xmlfragment("com.erpis.shiperp.hr7.parcelewm.fragment.RatePricingColumnListItem", this);
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
			var aAnalysis = this.getModel("local").getProperty("/RateAnalysis");
			try {
				this.getModel("local").setProperty("/CarrierRateAnalysis", this.treeify(aAnalysis, "NodeId", "ParentId"));
			} catch (exc) {
				this.getModel("local").setProperty("/CarrierRateAnalysis", []);
				this.oLogger.info("No Carrier Rate Analysis");
			}
		},

		onChangeRateAnalysisLine: function (oEvent) {
			var oObject = oEvent.getParameter("rowContext").getObject();
			var oTitle = sap.ui.getCore().byId("txtTabDesc");
			oTitle.setText(oObject.NodeDesc);
			if (this.analyRequest) {
				this.analyRequest.abort();
			}
			var oRequestData = this._generateAnalysisALVUsecase(oObject.NodeId);
			this.showBusy();
			this.getModel().create("/ShipmentQuerySet", oRequestData, {
				success: function (oData) {
					this.hideBusy();
					if (oData.return && oData.return.results.length > 0) {
						var aMsg = this._generateMessages(oData.return.results);
						this._addMessage(aMsg);
					}
					if (oData.HandlingUnits) {
						this.getModel("local").setProperty("/HandlingUnitLists", oData.HandlingUnits.results);
					}
					this.getModel("local").setProperty("/MessagesToFields", oData.Messages_To_Fields.results);
				}.bind(this),
				error: function (oError) {
					this._handleODataError(oError);
					this.getModel("local").setProperty("/MessagesToFields", []);
					this.hideBusy();
				}.bind(this)
			});
		},

		_generateAnalysisALVUsecase: function (nodeID) {
			var aHandlingUnits = this.getModel("local").getProperty("/HandlingUnitLists");
			var oData = {
				shipmentid: "",
				inputids: (this.sInputIDs) ? this.sInputIDs : "",
				inputtype: (this.sInputType) ? this.sInputType : "",
				ConsolidationSet: (this.aConsolidation) ? this.aConsolidation : [],
				profile: (this.sProfile) ? this.sProfile : "",
				warehousenum: (this.sWarehouseNumber) ? this.sWarehouseNumber : "",
				shippingstation: (this.sStation) ? this.sStation : "",
				action: "GetAnalysisALV",
				iv_node_key: JSON.stringify(nodeID),
				ALVDataAnalysis: this.getModel("local").getProperty("/ALVRateAnalysis") ? this.getModel("local").getProperty("/ALVRateAnalysis") : [],
				carrierMoreOption: [{
					valueList: []
				}],
				HandlingUnits: aHandlingUnits,
				basic: this.getModel("local").getProperty("/basic"),
				return: [],
				Messages_To_Fields: []
			};
			return oData;
		},

		onAnalysisClick: function () {
			var oRequestData = this._generateAnalysisParcelUsecase();
			this.showBusy();
			this.getModel().create("/ShipmentQuerySet", oRequestData, {
				success: function (oData) {
					try {
						this.getModel("local").setProperty("/RateAnalysis", oData.DataAnalysis.results);
					} catch (exc) {
						this.getModel("local").setProperty("/RateAnalysis", []);
						this.oLogger.info("No Carrier Rate Analysis");
					}
					if (oData.return && oData.return.results.length > 0) {
						var aMsg = this._generateMessages(oData.return.results);
						this._addMessage(aMsg);
					}
					if (oData.ALVDataAnalysis) {
						this.getModel("local").setProperty("/ALVRateAnalysis", oData.ALVDataAnalysis.results);
					}
					if (!this.oRateAnalysisDialog) {
						this.oRateAnalysisDialog = sap.ui.xmlfragment("com.erpis.shiperp.hr7.parcelewm.fragment.RateAnalysisDialog", this);
						this.getView().addDependent(this.oRateAnalysisDialog);
					}
					this.getModel('local').setProperty('/rateTitle', false);
					this.oRateAnalysisDialog.open();
					this.hideBusy();
				}.bind(this),
				error: function (oError) {
					this._handleODataError(oError);
					this.hideBusy();
				}.bind(this)
			});
		},

		_generateAnalysisParcelUsecase: function () {
			var aHandlingUnits = this.getModel("local").getProperty("/HandlingUnitLists");
			var oData = {
				shipmentid: "",
				inputids: (this.sInputIDs) ? this.sInputIDs : "",
				inputtype: (this.sInputType) ? this.sInputType : "",
				ConsolidationSet: (this.aConsolidation) ? this.aConsolidation : [],
				profile: (this.sProfile) ? this.sProfile : "",
				warehousenum: (this.sWarehouseNumber) ? this.sWarehouseNumber : "",
				shippingstation: (this.sStation) ? this.sStation : "",
				action: "GetParcelAnalysis",
				carrierMoreOption: [{
					valueList: []
				}],
				HandlingUnits: aHandlingUnits,
				basic: this.getModel("local").getProperty("/basic"),
				return: [],
				DataAnalysis: [],
				ALVDataAnalysis: []
			};
			return oData;
		},

		onConditonAnalysisDialog: function () {
			var sSelectedRow = sap.ui.getCore().byId("tableRateAnalysis").getSelectedIndices();
			if (!sSelectedRow || sSelectedRow.length === 0) {
				MessageBox.error(this.oBundle.getText("missingItemToshowsolidation"));
				return;
			}
			var sNodeId = sap.ui.getCore().byId("tableRateAnalysis").getRows()[sSelectedRow].getBindingContext("local").getObject().NodeId;
			this.getAnalysisCondition(sNodeId);
		},

		getAnalysisCondition: function (nodeID) {
			var oRequestData = this._generateAnalysisConditionUsecase(nodeID);
			this.showBusy();
			this.getModel().create("/ShipmentQuerySet", oRequestData, {
				success: function (oData) {
					this.hideBusy();
					if (oData.return && oData.return.results.length > 0) {
						var aMsg = this._generateMessages(oData.return.results);
						this._addMessage(aMsg);
					}
					if (oData.HandlingUnits) {
						this.getModel("local").setProperty("/HandlingUnitLists", oData.HandlingUnits.results);
					}
					this.getModel("local").setProperty("/ConditionTables", oData.CondTableSet.results);
					if (!this.oConditionTablesDialog) {
						this.oConditionTablesDialog = sap.ui.xmlfragment("com.erpis.shiperp.hr7.parcelewm.fragment.ConditionTablesDialog", this);
						this.getView().addDependent(this.oConditionTablesDialog);
					}
					this.oConditionTablesDialog.open();
				}.bind(this),
				error: function (oError) {
					this._handleODataError(oError);
					this.getModel("local").setProperty("/ConditionTables", []);
					this.hideBusy();
				}.bind(this)
			});
		},

		onconDitionTableClose: function () {
			this.oConditionTablesDialog.close();
		},

		_generateAnalysisConditionUsecase: function (nodeID) {
			var aHandlingUnits = [{
				carrierMoreOption: [{
					valueList: []
				}]
			}];
			if (this.getModel("local").getProperty("/HandlingUnitLists") && this.getModel("local").getProperty("/HandlingUnitLists").length > 0) {
				aHandlingUnits = this.getModel("local").getProperty("/HandlingUnitLists");
			}
			var oData = {
				shipmentid: "",
				inputids: (this.sInputIDs) ? this.sInputIDs : "",
				inputtype: (this.sInputType) ? this.sInputType : "",
				ConsolidationSet: (this.aConsolidation) ? this.aConsolidation : [],
				profile: (this.sProfile) ? this.sProfile : "",
				warehousenum: (this.sWarehouseNumber) ? this.sWarehouseNumber : "",
				shippingstation: (this.sStation) ? this.sStation : "",
				action: "GetAnalysisCondition",
				iv_node_key: JSON.stringify(nodeID),
				carrierMoreOption: this.getModel("local").getProperty("/ShipmentCarrierOptions"),
				HandlingUnits: aHandlingUnits,
				basic: this.getModel("local").getProperty("/basic"),
				return: [],
				CondTableSet: []
			};
			return oData;
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
				this.oRateDetailDialog = sap.ui.xmlfragment("com.erpis.shiperp.hr7.parcelewm.fragment.RateDetailsDialog", this);
				this.getView().addDependent(this.oRateDetailDialog);
			}
			var oObject = sap.ui.getCore().byId("tableRates").getSelectedItem().getBindingContext("local").getObject();
			var oRateDetailTemplate = sap.ui.xmlfragment("com.erpis.shiperp.hr7.parcelewm.fragment.RateDetailColumnListItem", this);
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
			this._changeCarrier(this.sCarrier);
		},

		// Pack and Unpack section
		onPackPartial: function () {
			var aSelectedHUs = this.oHUTable.getSelectedItems();
			if (aSelectedHUs.length > 1) {
				MessageBox.error(this.oBundle.getText("errorMPSSelectMsg"));
				return;
			}
			var aSelectedItems = this.oContentTable.getSelectedItems();
			if (aSelectedItems.length !== 1) {
				MessageBox.error(this.oBundle.getText("SelectItemPackPartial"));
				return;
			}
			if (aSelectedHUs.length !== 1) {
				MessageBox.error(this.oBundle.getText("SelectHUPack"));
				return;
			}
			this._packPartial();
		},

		onPackMaterial: function () {
			var aSelectedHUs = this.oHUTable.getSelectedItems();
			if (aSelectedHUs.length > 1) {
				MessageBox.error(this.oBundle.getText("errorMPSSelectMsg"));
				return;
			}
			var aSelectedItems = this.oContentTable.getSelectedItems();
			if (aSelectedItems.length === 0) {
				MessageBox.error(this.oBundle.getText("SelectItemPack"));
				return;
			}
			if (aSelectedHUs.length !== 1) {
				MessageBox.error(this.oBundle.getText("SelectHUPack"));
				return;
			}

			this._packMaterial();
		},

		onPackBundle: function () {
			if (!this.oPackBundleDialog) {
				this.oPackBundleDialog = sap.ui.xmlfragment("com.erpis.shiperp.hr7.parcelewm.fragment.PackBundleDialog", this);
				this.getView().addDependent(this.oPackBundleDialog);
			}
			this.parentPackMat = "PackBundle";
			this.oPackBundleDialog.open();
		},

		onPackBundleConfirm: function () {
			if (sap.ui.getCore().byId("txtPackMatBundle").getValue() === "") {
				sap.ui.getCore().byId("txtPackMatBundle").setValueState("Error");
				sap.ui.getCore().byId("txtPackMatBundle").setValueStateText(this.oBundle.getText("EnterPackMat"));
				return;
			} else {
				sap.ui.getCore().byId("txtPackMatBundle").setValueState("None");
			}
			this._packBundle();
		},

		onClosePackBundleDialog: function () {
			this.oPackBundleDialog.close();
		},

		onRepack: function () {
			var aSelectedHUs = this.oHUTable.getSelectedItems();
			if (aSelectedHUs.length > 1) {
				MessageBox.error(this.oBundle.getText("errorMPSSelectMsg"));
				return;
			}
			if (aSelectedHUs.length === 0) {
				MessageBox.error(this.oBundle.getText("SelectHUUnPack"));
				return;
			}
			if (this._numOfShippedItems(aSelectedHUs) > 0) {
				MessageBox.error(this.oBundle.getText("errorSelectedShippedItemsMsg"));
				return;
			}
			MessageBox.confirm(this.oBundle.getText("confirmRePackHUMessage"), {
				title: this.oBundle.getText("ConfirmRePacking"),
				actions: [sap.m.MessageBox.Action.YES, sap.m.MessageBox.Action.NO],
				initialFocus: sap.m.MessageBox.Action.YES,
				onClose: function (oAction) {
					if (oAction === MessageBox.Action.YES) {
						this._getRepackData(aSelectedHUs);
					}
				}.bind(this)
			});
		},

		onUnpack: function () {
			var aSelectedHUs = this.oHUTable.getSelectedItems();
			if (aSelectedHUs.length > 1) {
				MessageBox.error(this.oBundle.getText("errorMPSSelectMsg"));
				return;
			}
			if (aSelectedHUs.length === 0) {
				MessageBox.error(this.oBundle.getText("SelectHUUnPack"));
				return;
			}
			if (this._numOfShippedItems(aSelectedHUs) > 0) {
				MessageBox.error(this.oBundle.getText("errorSelectedShippedItemsMsg"));
				return;
			}
			if (aSelectedHUs[0].getBindingContext("local").getObject().HandlingUnitItems && aSelectedHUs[0].getBindingContext("local").getObject()
				.HandlingUnitItems
				.results.length === 0) {
				MessageBox.error(this.oBundle.getText("errorNoHUItems"));
				return;
			}
			MessageBox.confirm(this.oBundle.getText("confirmUnPackHUMessage"), {
				title: this.oBundle.getText("ConfirmUnPacking"),
				actions: [sap.m.MessageBox.Action.YES, sap.m.MessageBox.Action.NO],
				initialFocus: sap.m.MessageBox.Action.YES,
				onClose: function (oAction) {
					if (oAction === MessageBox.Action.YES) {
						this._unpack(aSelectedHUs, []);
					}
				}.bind(this)
			});
		},

		_getRepackData: function (aSelectedHUs) {
			var aHUItems = aSelectedHUs[0].getBindingContext("local").getObject().HandlingUnitItems.results;
			var aPackDetail = this.getModel("local").getProperty("/HUPackDetails");
			var aFinalPackageDetail = [];
			this.getModel("local").setProperty("/HUItems", aHUItems);
			for (var i = 0; i < aPackDetail.length; i++) {
				for (var j = 0; j < aHUItems.length; j++) {
					if (aHUItems[j].GuidParent === aPackDetail[i].GuidParent && aHUItems[j].GuidStock === aPackDetail[i].GuidStock) {
						aFinalPackageDetail.push(aPackDetail[i]);
					}
				}
			}
			this.getModel("local").setProperty("/HUFinalPackDetails", aFinalPackageDetail);
			this.oHUItemsDialog = Utils.getFragment("", "HUItemDialog", this);
			this.oHUItemsDialog.open();
		},

		onRePackItems: function () {
			var aSelected = this.byId("tableHUItems").getSelectedItems();
			if (aSelected.length === 0) {
				MessageBox.error(this.oBundle.getText("SelectItems"));
				return;
			}
			var aItemRepack = [];
			for (var i = 0; i < aSelected.length; i++) {
				aItemRepack.push(aSelected[i].getBindingContext("local").getObject());
			}
			this._unPackItems(aItemRepack);
		},

		_unPackItems: function (aItemRepack) {
			this.showBusy();
			var oRequestData = this._generateRepackItemUsecase(aItemRepack);
			this.getModel().create("/ShipmentQuerySet", oRequestData, {
				success: function (oData) {
					this.hideBusy();
					this.oHUItemsDialog.close();
					if (oData.PackScanner && oData.PackScanner.results.length > 0) {
						this.getModel("local").setProperty("/PackScanner", oData.PackScanner.results[0]);
					} else {
						this.getModel("local").setProperty("/PackScanner", {});
					}
					if (oData.HandlingUnitItemLists) {
						this.getModel("local").setProperty("/HUItemsList", oData.HandlingUnitItemLists.results);
					} else {
						this.getModel("local").setProperty("/HUItems", []);
					}
					if (oData.HandlingUnitPackDetails) {
						this.getModel("local").setProperty("/HUPackDetails", oData.HandlingUnitPackDetails.results);
					} else {
						this.getModel("local").setProperty("/HUPackDetails", []);
					}
					if (oData.HandlingUnits) {
						this.getModel("local").setProperty("/HandlingUnitLists", oData.HandlingUnits.results);
					}
					this._handleHUList();
					if (oData.return && oData.return.results.length > 0) {
						var aMsg = this._generateMessages(oData.return.results);
						this._addMessage(aMsg);
					}
					var aHUList = this.getModel("local").getProperty("/HandlingUnitLists");
					var aHUListRemove = [];
					for (var a = 0; a < aHUList.length; a++) {
						if (parseInt(aHUList[a].Outbhu, 10) !== (parseInt(oData.PackScanner.results[0].SourceId, 10))) {
							aHUListRemove.push(aHUList[a]);
						}
					}

					this.getModel("local").setProperty("/DestHU", aHUListRemove);
					if (!this.oRepackOutboundHU) {
						this.oRepackOutboundHU = sap.ui.xmlfragment("com.erpis.shiperp.hr7.parcelewm.fragment.RePackItemDialog", this);
						this.getView().addDependent(this.oRepackOutboundHU);
					}
					this.parentPackMat = "Repack";
					this.oRepackOutboundHU.open();
				}.bind(this),
				error: function (oError) {
					this._handleODataError(oError);
					this.hideBusy();
				}.bind(this)
			});
		},

		onCloseRepackOutboundHUDialog: function () {
			this.oRepackOutboundHU.close();
		},

		onRepackOutboundHUConfirm: function () {
			var oPackScanner = this.getModel("local").getProperty("/PackScanner");
			oPackScanner.DestPmatNo = sap.ui.getCore().byId("txtPackMatRepack").getValue();
			this._saveRepack(oPackScanner);
		},

		_saveRepack: function (oPackScanner) {
			this.showBusy();
			var oRequestData = this._generateSaveRepackUsecase(oPackScanner);
			this.getModel().create("/ShipmentQuerySet", oRequestData, {
				success: function (oData) {
					if (oData.return) {
						if (oData.return.results.length > 0) {
							var aMsg = this._generateMessages(oData.return.results);
							this._addMessage(aMsg);
						} else {
							MessageToast.show(this.oBundle.getText("HURepackSuccess"));
							this.hideBusy();
						}
					}
					if (oData.HandlingUnits) {
						this.getModel("local").setProperty("/HandlingUnitLists", oData.HandlingUnits.results);
					} else {
						this.getModel("local").setProperty("/HandlingUnitLists", []);
					}
					if (oData.Contents) {
						this.getModel("local").setProperty("/Contents", oData.Contents.results);
					} else {
						this.getModel("local").setProperty("/Contents", []);
					}
					if (oData.HandlingUnitItemLists) {
						this.getModel("local").setProperty("/HUItemsList", oData.HandlingUnitItemLists.results);
					} else {
						this.getModel("local").setProperty("/HUItems", []);
					}
					if (oData.HandlingUnitPackDetails) {
						this.getModel("local").setProperty("/HUPackDetails", oData.HandlingUnitPackDetails.results);
					} else {
						this.getModel("local").setProperty("/HUPackDetails", []);
					}
					if (oData.HandlingUnits) {
						this.getModel("local").setProperty("/HandlingUnitLists", oData.HandlingUnits.results);
					}
					this._handleHUList();
					this._refreshData();

					this.oRepackOutboundHU.close();
				}.bind(this),
				error: function (oError) {
					this._handleODataError(oError);
					this.hideBusy();
				}.bind(this)
			});
		},
		_generateSaveRepackUsecase: function (oPackScanner) {
			var aHandlingUnits = [{
				carrierMoreOption: [{
					valueList: []
				}]
			}];
			if (this.getModel("local").getProperty("/HandlingUnitLists").length > 0) {
				aHandlingUnits = this.getModel("local").getProperty("/HandlingUnitLists");
			}
			var oData = {
				shipmentid: "",
				shippingstation: (this.sStation) ? this.sStation : "",
				inputtype: (this.sInputType) ? this.sInputType : "",
				ConsolidationSet: (this.aConsolidation) ? this.aConsolidation : [],
				profile: (this.sProfile) ? this.sProfile : "",
				carrierMoreOption: this.getModel("local").getProperty("/ShipmentCarrierOptions"),
				// basic: this.getModel("local").getProperty("/basic"),
				inputids: (this.sInputIDs) ? this.sInputIDs : "",
				warehousenum: (this.sWarehouseNumber) ? this.sWarehouseNumber : "",
				action: "SaveRepack",
				HandlingUnits: aFreightunits,
				PackScanner: [oPackScanner],
				return: [],
				HandlingUnits: [],
				HandlingUnitItemLists: [{
					HandlingUnitItems: (this.aHUItemsSelected) ? this.aHUItemsSelected : []
				}],
				HandlingUnitPackDetails: [],
				Contents: []
			};
			return oData;
		},

		_generateRepackItemUsecase: function (aItemRepack) {
			var aHUItems = this.getModel("local").getProperty("/HUItems");
			this.aHUItemsSelected = [];
			for (var i = 0; i < aHUItems.length; i++) {
				for (var j = 0; j < aItemRepack.length; j++) {
					if (aHUItems[i].GuidParent === aItemRepack[j].GuidParent && aHUItems[i].GuidStock === aItemRepack[j].GuidStock) {
						delete aHUItems[j].ShipmentQuery;
						aHUItems[j].Matid = '';
						this.aHUItemsSelected.push(aHUItems[j]);
					}
				}
			}
			var aSelectedHus = this.oHUTable.getSelectedItems();
			var aHandlingUnits = [];
			for (var k = 0; k < aSelectedHus.length; k++) {
				aHandlingUnits.push(aSelectedHus[k].getBindingContext("local").getObject());
			}

			var oData = {
				shipmentid: "",
				shippingstation: (this.sStation) ? this.sStation : "",
				inputtype: (this.sInputType) ? this.sInputType : "",
				ConsolidationSet: (this.aConsolidation) ? this.aConsolidation : [],
				profile: (this.sProfile) ? this.sProfile : "",
				inputids: (this.sInputIDs) ? this.sInputIDs : "",
				warehousenum: (this.sWarehouseNumber) ? this.sWarehouseNumber : "",
				action: "Repack",
				HandlingUnits: this._handleHUSPayload(aHandlingUnits),
				HandlingUnitItemLists: [{
					HandlingUnitItems: (this.aHUItemsSelected) ? this.aHUItemsSelected : []
				}],
				HandlingUnitPackDetails: [],
				PackScanner: [],
				return: []
			};
			return oData;
		},

		_handleHUSPayload: function (aHUS) {
			var aHandlingUnit = [];
			if (aHUS && aHUS.length > 0) {
				for (var i = 0; i < aHUS.length; i++) {
					var oHandlingUnit = {};
					oHandlingUnit.Outbhu = aHUS[i].Outbhu;
					oHandlingUnit.Pmat = aHUS[i].Pmat;
					oHandlingUnit.LgplaPa = aHUS[i].LgplaPa;
					oHandlingUnit.Laeng = aHUS[i].Laeng;
					oHandlingUnit.Breit = aHUS[i].Breit;
					oHandlingUnit.Hoehe = aHUS[i].Hoehe;
					oHandlingUnit.Meabm = aHUS[i].Meabm;
					oHandlingUnit.Weight = aHUS[i].Weight;
					oHandlingUnit.Weightunit = aHUS[i].Weightunit;
					oHandlingUnit.Sel = aHUS[i].Sel;
					oHandlingUnit.Trackingnumber = aHUS[i].Trackingnumber;
					oHandlingUnit.Docno = aHUS[i].Docno;
					oHandlingUnit.Doccat = aHUS[i].Doccat;
					oHandlingUnit.Overpack = aHUS[i].Overpack;
					oHandlingUnit.Statusdg = aHUS[i].Statusdg;
					aHandlingUnit.push(oHandlingUnit);
				}
			}
			if (aHandlingUnit.length > 0) {
				var check = {};
				var res = [];
				for (var j = 0; j < aHandlingUnit.length; j++) {
					if (!check[aHandlingUnit[j]['Outbhu']]) {
						check[aHandlingUnit[j]['Outbhu']] = true;
						res.push(aHandlingUnit[j]);
					}
				}
				aHandlingUnit = res;
			}
			return aHandlingUnit;
		},

		_generateGetHUItemsUsecase: function (aSelectedHUs) {
			var aHandlingUnits = [{
				carrierMoreOption: [{
					valueList: []
				}]
			}];
			if (this.getModel("local").getProperty("/HandlingUnitLists") && this.getModel("local").getProperty("/HandlingUnitLists").length > 0) {
				aHandlingUnits = this.getModel("local").getProperty("/HandlingUnitLists");
			}
			var HUSList = this._handleHUSPayload(aSelectedHUs);
			var oData = {
				shipmentid: "",
				inputids: (this.sInputIDs) ? this.sInputIDs : "",
				ConsolidationSet: (this.aConsolidation) ? this.aConsolidation : [],
				inputtype: (this.sInputType) ? this.sInputType : "",
				profile: (this.sProfile) ? this.sProfile : "",
				warehousenum: (this.sWarehouseNumber) ? this.sWarehouseNumber : "",
				shippingstation: (this.sStation) ? this.sStation : "",
				action: "GetHUItems",
				carrierMoreOption: this.getModel("local").getProperty("/ShipmentCarrierOptions"),
				HandlingUnits: aHandlingUnits,
				basic: this.getModel("local").getProperty("/basic"),
				HandlingUnits: HUSList,
				HandlingUnitItemLists: [{
					HandlingUnitItems: []
				}],
				HandlingUnitPackDetails: []
			};
			return oData;
		},
		onCloseHUItemsDialog: function () {
			this.oHUItemsDialog.close();
		},
		onExecute: function () {
			// var sMPSStatus = this.getModel("local").getProperty("/basic/carrier_data/mps/mps");
			var aSelectedHUs = this.oHUTable.getSelectedItems();
			var sMPSType = this.getModel("local").getProperty("/basic/carrier_data/mps/mpstype");
			if (sMPSType === "02") {
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
		},

		onPrintShipLabel: function () {
			var aSelectedHUs = [];
			// Get the selected HandlingUnitLists depending on the Packing scenario
			if (this._getPackingScenario() === "01") { // Main Screen Scenario
				aSelectedHUs = this.oHUTable.getSelectedItems();
			} else if (this._getPackingScenario() === "02") { // Pack by Material Dialog
				aSelectedHUs = this.oHUTable.getSelectedItems();
			} else if (this._getPackingScenario() === "03") { // Pack by HU Dialog
				aSelectedHUs = this.oHURightTable.getSelectedItems();
			} else { // Default
				aSelectedHUs = this.oHUTable.getSelectedItems();
			}
			if (aSelectedHUs.length === 0) {
				aSelectedHUs = this.oHUTable.getItems();
			}
			this._PrintShipLabelHUs(aSelectedHUs);
		},

		_PrintShipLabelHUs: function (aSelectedHUs) {
			var oRequestData = this._generatePrintHUUsecase(aSelectedHUs);
			this.showBusy();
			this.getModel().create("/ShipmentQuerySet", oRequestData, {
				success: function (oData) {
					if (oData.ShipmentLabelSet) {
						var contentType;
						var blob;
						var fileURL;
						if (oData.ShipmentLabelSet.results.length === 0) {
							MessageBox.error(this.oBundle.getText("NoPrintPreview"));
						}
						for (var b = 0; b < oData.ShipmentLabelSet.results.length; b++) {
							var shipmentLabelItem = oData.ShipmentLabelSet.results[b];
							if (shipmentLabelItem.OutputType === "PDF") {
								MessageToast.show(this.oBundle.getText("PrintSuccess"));
								var binary = atob(shipmentLabelItem.Output_Data.replace(/\s/g, ''));
								var len = binary.length;
								var buffer = new ArrayBuffer(len);
								var view = new Uint8Array(buffer);
								for (var i = 0; i < len; i++) {
									view[i] = binary.charCodeAt(i);
								}
								var blob = new Blob([view], {
									type: "application/pdf"
								});
								var url = URL.createObjectURL(blob);
								window.open(url);
							} else if (shipmentLabelItem.OutputType === "GIF") {
								MessageToast.show(this.oBundle.getText("PrintSuccess"));
								contentType = 'image/gif';
								blob = this.b64toBlob(shipmentLabelItem.Output_Data, contentType);
								fileURL = URL.createObjectURL(blob);
								window.open(fileURL);
							}
						}
						this.hideBusy();
					}
				}.bind(this),
				error: function (oError) {
					this._handleODataError(oError);
					this.hideBusy();
				}.bind(this)
			});
		},

		_generatePrintHUUsecase: function (aSelectedHUs) {
			var aHandlingUnits = [];
			var aHUList = this.getModel("local").getProperty("/HandlingUnitLists");
			for (var i = 0; i < aHUList.length; i++) {
				for (var j = 0; j < aSelectedHUs.length; j++) {
					if (aHUList[i].Outbhu === aSelectedHUs[j].getBindingContext("local").getObject().Outbhu) {
						aHUList[i].Sel = 'X';
						aHandlingUnits.push(aHUList[i]);
					}
				}
			}
			var HUSList = this._handleHUSPayload(aHandlingUnits);
			var oData = {
				shipmentid: "",
				inputids: (this.sInputIDs) ? this.sInputIDs : "",
				inputtype: (this.sInputType) ? this.sInputType : "",
				ConsolidationSet: (this.aConsolidation) ? this.aConsolidation : [],
				profile: (this.sProfile) ? this.sProfile : "",
				warehousenum: (this.sWarehouseNumber) ? this.sWarehouseNumber : "",
				shippingstation: (this.sStation) ? this.sStation : "",
				action: "PrintShipLabel",
				carrierMoreOption: this.getModel("local").getProperty("/ShipmentCarrierOptions"),
				basic: this.getModel("local").getProperty("/basic"),
				HandlingUnits: HUSList,
				HandlingUnitItemLists: [{
					HandlingUnitItems: []
				}],
				HandlingUnitPackDetails: [],
				Contents: [],
				OutputListSet: [],
				ShipmentLabelSet: []
			};
			return oData;
		},

		onChangeScaleOption: function () {
			if (this.getModel("local").getProperty("/UseScale")) {
				this.showBusy();
				var oRequestData = this._generateChangeWeightDimUsecase();
				this.getModel().create("/ShipmentQuerySet", oRequestData, {
					success: function (oData) {
						this.hideBusy();
						if (oData.return && oData.return.results.length > 0) {
							var aMsg = this._generateMessages(oData.return.results);
							this._addMessage(aMsg);
						}
						if (oData.HandlingUnits) {
							this.getModel("local").setProperty("/HandlingUnitLists", oData.HandlingUnits.results);
						} else {
							this.getModel("local").setProperty("/HandlingUnitLists", []);
						}
						this._handleHUList();
						this._refreshData();
						if (this.getModel("local").getProperty("/UseScale") === "1") {
							this._getExternalScale();
						} else if (this.getModel("local").getProperty("/UseScale") === "2") {
							// this._refreshPackingData(true);
							this.enableEditHandlingUnits(false);
							this.getModel("local").setProperty("/aHandlingUnitEdits", []);
						} else if (this.getModel("local").getProperty("/UseScale") === "3") {
							this.enableEditHandlingUnits(true);
						} else {
							// this._refreshPackingData(true);
							this.enableEditHandlingUnits(false);
						}
					}.bind(this),
					error: function (oError) {
						this._handleODataError(oError);
						this.hideBusy();
					}.bind(this)
				});
			}
		},

		onMassUpdateScales: function () {
			var oMassUpdateScale = {
				weightunit: "",
				weight: "",
				length: "",
				width: "",
				height: "",
				dimensionunit: ""
			};
			this.getModel("local").setProperty("/oMassUpdateScale", oMassUpdateScale);
			this.oMassScaleUpdateDialog = Utils.getFragment("", "MassScaleUpdateDialog", this);
			this.getModel("local").setProperty("/inputEnabled", false);
			this.oMassScaleUpdateDialog.open();
		},

		onCloseMassScaleUpdateDialog: function () {
			this.oMassScaleUpdateDialog.close();
		},

		onConfirmMassUpdateScale: function () {
			this.showBusy();
			var oMassUpdateScale = this.getModel("local").getProperty("/oMassUpdateScale");
			var oRequestData = this._generateChangeWeightDimUsecaseForUpdateScale("", oMassUpdateScale);
			this.getModel().create("/ShipmentQuerySet", oRequestData, {
				success: function (oData) {
					this.hideBusy();
					if (oData.return && oData.return.results.length > 0) {
						var aMsg = this._generateMessages(oData.return.results);
						this._addMessage(aMsg);
					}
					if (oData.HandlingUnits) {
						this.getModel("local").setProperty("/HandlingUnitLists", oData.HandlingUnits.results);
					} else {
						this.getModel("local").setProperty("/HandlingUnitLists", []);
					}
					this._handleHUList();
					this._refreshData();
					this.oMassScaleUpdateDialog.close();
				}.bind(this),
				error: function (oError) {
					this._handleODataError(oError);
					this.hideBusy();
				}.bind(this)
			});
		},

		initValidate: function () {
			var bValid = false;
			var aIDInput = ["idWeight", "idLength", "idWidth", "idHeight"];
			for (var i = 0; i < aIDInput.length; i++) {
				var sValue = this.byId(aIDInput[i]).getValue().trim();
				if (sValue) {
					bValid = true;
					this.getModel("local").setProperty("/inputEnabled", bValid);
				} else {
					this.getModel("local").setProperty("/inputEnabled", bValid);
				}
			}
		},

		_generateChangeWeightDimUsecaseForUpdateScale: function (sHuNum, oMassUpdateScale) {
			var aHUList = this.getModel("local").getProperty("/HandlingUnitLists");
			var aHandlingUnit = [];
			var bUpdate = false;
			if (sHuNum) {
				for (var i = 0; i < aHUList.length; i++) {
					if (aHUList[i].Outbhu === sHuNum) {
						aHUList[i].Sel = 'X';
					}
				}
				aHandlingUnit = aHUList;
				bUpdate = true;
			} else {
				if (oMassUpdateScale) {
					if (oMassUpdateScale.dimensionunit === "" && oMassUpdateScale.width === "" && oMassUpdateScale.height === "" && oMassUpdateScale.length ===
						"" && oMassUpdateScale.weight === "" && oMassUpdateScale.weightunit === "") {
						MessageBox.error(this.oBundle.getText("Fields cannot be empty"));
						this.hideBusy();
						return false;
					}
					var keyLWHList = ["weight", "weightunit", "length", "width", "height", "dimensionunit"];
					var isKey2 = false;
					var isKey3 = false;
					for (var property in oMassUpdateScale) {
						// if (oMassUpdateScale[property]) {
						this.getModel("local").setProperty("/inputEnabled", true);
						if (keyLWHList.includes(property)) {
							if (property === "weightunit") {
								if (oMassUpdateScale.weightunit === "") {
									isKey2 = true;
								}
								// break;
							}
							if (property === "dimensionunit") {
								if (oMassUpdateScale.dimensionunit === "") {
									isKey3 = true;
								}
								// break;
							}
						}
					}
					if (isKey2) {
						MessageBox.error(this.oBundle.getText("Weight unit cannot be empty"));
						this.hideBusy();
						return false;
					} else if (isKey3) {
						MessageBox.error(this.oBundle.getText("Dimension unit cannot be empty"));
						this.hideBusy();
						return false;
					}

					for (var j = 0; j < aHUList.length; j++) {
						if (oMassUpdateScale.length !== "") {
							aHUList[j].Laeng = oMassUpdateScale.length;
						}
						if (oMassUpdateScale.width !== "") {
							aHUList[j].Breit = oMassUpdateScale.width;
						}
						if (oMassUpdateScale.height !== "") {
							aHUList[j].Hoehe = oMassUpdateScale.height;
						}
						if (oMassUpdateScale.weight !== "") {
							aHUList[j].Weight = oMassUpdateScale.weight;
						}
						aHUList[j].Meabm = oMassUpdateScale.dimensionunit;
						aHUList[j].Weightunit = oMassUpdateScale.weightunit;
					}
					aHandlingUnit = aHUList;
					bUpdate = true;
				} else {
					aHandlingUnit = aHUList;
				}
				this.getModel("local").setProperty("/inputEnabled", false);
			}

			var sOption = this.getModel("local").getProperty("/UseScale");
			if (bUpdate) {
				if (sOption === '2' || sOption === '4') {
					sOption = '3';
				}
			}

			var oData = {
				shipmentid: "",
				inputids: (this.sInputIDs) ? this.sInputIDs : "",
				inputtype: (this.sInputType) ? this.sInputType : "",
				ConsolidationSet: (this.aConsolidation) ? this.aConsolidation : [],
				profile: (this.sProfile) ? this.sProfile : "",
				warehousenum: (this.sWarehouseNumber) ? this.sWarehouseNumber : "",
				shippingstation: (this.sStation) ? this.sStation : "",
				option: JSON.stringify(parseInt(sOption, 10)),
				iupdate: bUpdate,
				action: "ChangeWeightDim",
				carrierMoreOption: [{
					valueList: []
				}],
				return: [],
				HandlingUnits: this._handleHUSPayload(aHandlingUnit)
			};
			return oData;
		},

		onNAFTAPress: function () {
			this.oNaftaDialog = Utils.getFragment("", "NAFTADialog", this);
			this.oNaftaDialog.open();
		},

		onCloseNAFTAialog: function () {
			this.oNaftaDialog.close();
		},

		onComercialInvoicePress: function () {
			this.onComercialInvoiceDialog = Utils.getFragment("", "ComercialInvoiceDialog", this);
			this.onComercialInvoiceDialog.open();
		},

		onCloseComercialInvoiceDialog: function () {
			this.onComercialInvoiceDialog.close();
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

		onGoToSetWeightDimColumn: function (oEvent) {
			// this.bIsEnterPressedOnHU = false;
			// this.oHUWeightChange.HU = oEvent.getSource().getBindingContext("local").getObject().Outbhu;
			// this.oHUWeightChange.Index = 5;
			this.showBusy();
			var sHuNum = oEvent.getSource().getBindingContext("local").getObject().Outbhu;
			var oRequestData = this._generateChangeWeightDimUsecase(sHuNum);
			this.getModel().create("/ShipmentQuerySet", oRequestData, {
				success: function (oData) {
					this.hideBusy();
					if (oData.return && oData.return.results.length > 0) {
						var aMsg = this._generateMessages(oData.return.results);
						this._addMessage(aMsg);
					}
					if (oData.HandlingUnits) {
						this.getModel("local").setProperty("/HandlingUnitLists", oData.HandlingUnits.results);
					} else {
						this.getModel("local").setProperty("/HandlingUnitLists", []);
					}
					this._handleHUList();
					this._refreshData();
				}.bind(this),
				error: function (oError) {
					this._handleODataError(oError);
					this.hideBusy();
				}.bind(this)
			});
		},
		_generateChangeWeightDimUsecase: function (sHuNum, oMassUpdateScale) {
			var aHUList = this.getModel("local").getProperty("/HandlingUnitLists");
			var aHandlingUnit = [];
			var bUpdate = false;
			if (sHuNum) {
				for (var i = 0; i < aHUList.length; i++) {
					if (aHUList[i].Outbhu === sHuNum) {
						aHUList[i].Sel = 'X';
					}
				}
				aHandlingUnit = aHUList;
				bUpdate = true;
			} else {
				if (oMassUpdateScale) {
					for (var j = 0; j < aHUList.length; j++) {
						aHUList[j].Laeng = oMassUpdateScale.length;
						aHUList[j].Breit = oMassUpdateScale.width;
						aHUList[j].Hoehe = oMassUpdateScale.height;
						aHUList[j].Weight = oMassUpdateScale.weight;
						aHUList[j].Meabm = oMassUpdateScale.dimensionunit;
						aHUList[j].Weightunit = oMassUpdateScale.weightunit;
					}
					aHandlingUnit = aHUList;
					bUpdate = true;
				} else {
					aHandlingUnit = aHUList;
				}
			}

			var sOption = this.getModel("local").getProperty("/UseScale");
			if (bUpdate) {
				if (sOption === '2' || sOption === '4') {
					sOption = '3';
				}
			}

			var oData = {
				shipmentid: "",
				inputids: (this.sInputIDs) ? this.sInputIDs : "",
				inputtype: (this.sInputType) ? this.sInputType : "",
				ConsolidationSet: (this.aConsolidation) ? this.aConsolidation : [],
				profile: (this.sProfile) ? this.sProfile : "",
				warehousenum: (this.sWarehouseNumber) ? this.sWarehouseNumber : "",
				shippingstation: (this.sStation) ? this.sStation : "",
				option: JSON.stringify(parseInt(sOption, 10)),
				iupdate: bUpdate,
				action: "ChangeWeightDim",
				carrierMoreOption: [{
					valueList: []
				}],
				return: [],
				HandlingUnits: this._handleHUSPayload(aHandlingUnit)
			};
			return oData;
		},

		onGoToWidthColumn: function (oEvent) {
			this.bIsEnterPressedOnHU = false;
			this.oHUWeightChange.HU = oEvent.getSource().getBindingContext("local").getObject().Outbhu;
			this.oHUWeightChange.Index = 6;
		},

		onGoToHeightColumn: function (oEvent) {
			this.bIsEnterPressedOnHU = false;
			this.oHUWeightChange.HU = oEvent.getSource().getBindingContext("local").getObject().Outbhu;
			this.oHUWeightChange.Index = 7;
		},

		onGoToUoMColumn: function (oEvent) {
			this.bIsEnterPressedOnHU = false;
			this.oHUWeightChange.HU = oEvent.getSource().getBindingContext("local").getObject().Outbhu;
			this.oHUWeightChange.Index = 8;
		},

		onSerialPress: function () {
			if (!this.oSerialDialog) {
				this.oSerialDialog = sap.ui.xmlfragment("com.erpis.shiperp.hr7.parcelewm.fragment.SerialDialog", this);
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
				if (item.material === oData.matnr && item.delivery === oData.docno) {
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
			var aSerialCount = this.getModel("local").getProperty("/MasterSerialList");
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
				for (var i = 0; i < aSerialList.length; i++) {
					if (typeof aSerialList[i].POSNR === "number") {
						aSerialList[i].POSNR = aSerialList[i].POSNR.toString();
					}
				}
			}.bind(this));

			this.getModel("local").setProperty("/SelectedSerial/SerialItemSet/results", aSerialList);
			this._onCheckCountCreate(aSerialCount);
			oControl.setValue("");
		},

		_onCheckCountCreate: function (aSerialCount) {
			var serial_count = 0;
			for (var i = 0; i < aSerialCount.length; i++) {
				aSerialCount[i].SerialItemSet.results.forEach(function (items) {
					if (items.SERNR !== "") {
						serial_count++;
					}
				});
				aSerialCount[i].serial_count = String(serial_count);
				serial_count = 0;
			}
			this.getModel("local").setProperty("/MasterSerialList", aSerialCount);
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
			var aSerialCount = this.getModel("local").getProperty("/MasterSerialList");
			for (var i = 0; i < aSerialList.length; i++) {
				aSerialList[i].SERNR = "";

			}
			for (var j = 0; j < aSerialCount.length; j++) {
				aSerialCount[j].serial_count = "0";
			}
			this.getModel("local").setProperty("/MasterSerialList", aSerialCount);
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
			var aSerialCount = this.getModel("local").getProperty("/MasterSerialList");
			var aSerialList = this.getModel("local").getProperty("/SelectedSerial/SerialItemSet/results");
			var aSerialSet = this.getModel("local").getProperty("/SelectedSerial/SerialItemSet").results || [];
			for (var i = 0; i < aSerialList.length; i++) {
				if (typeof aSerialList[i].POSNR === "number") {
					aSerialList[i].POSNR = aSerialList[i].POSNR.toString();
				}
			}
			this._onCheckCountCreate(aSerialCount);
			this.getModel("local").setProperty("/SelectedSerial/SerialItemSet/results", aSerialList);
			var count = 0;
			if (!sValue) {
				return;
			}
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
					if (oData.HandlingUnits) {
						this.getModel("local").setProperty("/HandlingUnitLists", oData.HandlingUnits.results);
					}
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
					if (oData.return && oData.return.results.length > 0) {
						var aMsg = this._generateMessages(oData.return.results);
						this._addMessage(aMsg);
					}
					if (oData.HandlingUnits) {
						this.getModel("local").setProperty("/HandlingUnitLists", oData.HandlingUnits.results);
					}
					var oNewAddress = oData.basic.partners.shipto;
					var sPostalCode = oData.ValAddressSet.results;
					this.getModel("local").setProperty("/NewAddress", oNewAddress);
					this.getModel("local").setProperty("/PostalCode", sPostalCode);
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
			var aPostalCode = this.getModel("local").getProperty("/PostalCode");
			this.getModel("local").setProperty("/PostalCodeValidateEmail", aPostalCode);
			var OldAddress = this.getModel("local").getProperty("/basic/partners/shipto");
			this._copyObject(OldAddress, oNewAddress);
			this.getModel("local").setProperty("/basic/partners/shipto", OldAddress);
			this.oValidateAdressDialog.close();
		},

		onEditItemPackingPress: function (oEvent) {
			var oControl = oEvent.getSource();
			var bEditable = oControl.getPressed();
			var oData = oControl.getBindingContext("local").getObject();
			var aHandlingUnitEdits = this.getModel("local").getProperty("/aHandlingUnitEdits") || [];
			if (bEditable) {
				if (this.getModel("local").getProperty("/UseScale") === "1") {
					// Make column length editable
					oEvent.getSource().getParent().getParent().getCells()[6].getItems()[0].setVisible(true);
					oEvent.getSource().getParent().getParent().getCells()[6].getItems()[1].setVisible(false);
					// Make column width editable
					oEvent.getSource().getParent().getParent().getCells()[7].getItems()[0].setVisible(true);
					oEvent.getSource().getParent().getParent().getCells()[7].getItems()[1].setVisible(false);
					// Make column height editable
					oEvent.getSource().getParent().getParent().getCells()[8].getItems()[0].setVisible(true);
					oEvent.getSource().getParent().getParent().getCells()[8].getItems()[1].setVisible(false);
					// Make column UoM editable
					oEvent.getSource().getParent().getParent().getCells()[9].getItems()[0].setVisible(true);
					oEvent.getSource().getParent().getParent().getCells()[9].getItems()[1].setVisible(false);
					aHandlingUnitEdits.push(oData.Outbhu);
				} else if (this.getModel("local").getProperty("/UseScale") === "2" || this.getModel("local").getProperty("/UseScale") ===
					"4") {
					aHandlingUnitEdits.push(oData.Outbhu);
					this.enableEditHandlingUnit(oEvent.getSource().getParent().getParent(), true);
				}
			} else {
				// remove
				var index = aHandlingUnitEdits.indexOf(oData.Outbhu);
				if (index > -1) {
					aHandlingUnitEdits.splice(index, 1);
				}
				// Make column weight uneditable
				oEvent.getSource().getParent().getParent().getCells()[5].getItems()[0].setVisible(false);
				oEvent.getSource().getParent().getParent().getCells()[5].getItems()[1].setVisible(true);
				// Make column width uneditable
				oEvent.getSource().getParent().getParent().getCells()[7].getItems()[0].setVisible(false);
				oEvent.getSource().getParent().getParent().getCells()[7].getItems()[1].setVisible(true);
				// Make column height uneditable
				oEvent.getSource().getParent().getParent().getCells()[8].getItems()[0].setVisible(false);
				oEvent.getSource().getParent().getParent().getCells()[8].getItems()[1].setVisible(true);
				// Make column H uneditable
				oEvent.getSource().getParent().getParent().getCells()[9].getItems()[0].setVisible(false);
				oEvent.getSource().getParent().getParent().getCells()[9].getItems()[1].setVisible(true);
				//UOM
				oEvent.getSource().getParent().getParent().getCells()[10].getItems()[0].setVisible(false);
				oEvent.getSource().getParent().getParent().getCells()[10].getItems()[1].setVisible(true);
			}
			this.getModel("local").setProperty("/aHandlingUnitEdits", aHandlingUnitEdits);
		},

		onHUTableUpdateFinished: function (oEvent) {
			var aHUs = oEvent.getSource().getItems();
			var oObject;
			var oButton, oInput;
			// This block is used to handle reupdate toggle button pressed state when model gets changed
			if (this.sHUWeightExtScaleChange !== "") {
				for (var j = 0; j < aHUs.length; j++) {
					oObject = aHUs[j].getBindingContext("local").getObject();
					if (oObject.Outbhu === this.sHUWeightExtScaleChange) {
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
					if (oObject.Outbhu === this.oHUWeightChange.HU) {
						this.oHUWeightChange.HU = "";
						oInput = aHUs[i].getCells()[this.oHUWeightChange.Index].getItems()[0];
						oInput.focus();
						$("#" + oInput.getId() + "-inner").select();
						break;
					}
				}
			}
			// This block is used to handle hazmat highlight indicator when data changed and hazmat indicator is flagged
			// if (this.getModel("local").getProperty("/basic/shipment_flags/HazmatExist")) {
			// 	for (var i = 0; i < aHUs.length; i++) {
			// 		oObject = aHUs[i].getBindingContext("local").getObject();
			// 		if (this.mFreightUnitHazmatItems[oObject.Outbhu] === null) {
			// 			if (oObject.FreightunitHazmat.results) {
			// 				if (oObject.FreightunitHazmat.results.length > 0) {
			// 					aHUs[i].setHighlight(sap.ui.core.ValueState.Error);
			// 					aHUs[i].setTooltip(this.oBundle.getText("hazmatNotMaintainedTooltip"));
			// 				} else {
			// 					aHUs[i].setHighlight(sap.ui.core.ValueState.None);
			// 					aHUs[i].setTooltip("");
			// 				}
			// 			} else {
			// 				aHUs[i].setHighlight(sap.ui.core.ValueState.None);
			// 				aHUs[i].setTooltip("");
			// 			}
			// 		} else {
			// 			var bMaintained = true;
			// 			for (var j = 0; j < this.mFreightUnitHazmatItems[oObject.Outbhu].length; j++) {
			// 				if (this.mFreightUnitHazmatItems[oObject.Outbhu][j].Selected === "X") {
			// 					if (this.mFreightUnitHazmatItems[oObject.Outbhu][j].Updated === "") {
			// 						bMaintained = false;
			// 						break;
			// 					}
			// 				} else {
			// 					continue;
			// 				}
			// 			}
			// 			if (bMaintained) {
			// 				aHUs[i].setHighlight("Success");
			// 				aHUs[i].setTooltip(this.oBundle.getText("hazmatMaintainedTooltip"));
			// 			} else {
			// 				if (oObject.FreightunitHazmat.results) {
			// 					if (oObject.FreightunitHazmat.results.length > 0) {
			// 						aHUs[i].setHighlight(sap.ui.core.ValueState.Error);
			// 						aHUs[i].setTooltip(this.oBundle.getText("hazmatNotMaintainedTooltip"));
			// 					} else {
			// 						aHUs[i].setHighlight(sap.ui.core.ValueState.None);
			// 						aHUs[i].setTooltip("");
			// 					}
			// 				} else {
			// 					aHUs[i].setHighlight(sap.ui.core.ValueState.None);
			// 					aHUs[i].setTooltip("");
			// 				}
			// 			}
			// 		}
			// 	}
			// }
			// This block is used to check if shipment is complete
			if (!this.bCheckShipmentComplete) {
				this._checkShipmentComplete();
			}
			//  selected line when SEL field is flagged
			if (aHUs.length > 0) {
				aHUs.forEach(function (oItem) {
					var oData = oItem.getBindingContext("local").getObject();
					if (oData.Sel === 'X') {
						oEvent.getSource().setSelectedItem(oItem); // chọn dòng có nameflag === 'X'
					}
				});
			}

		},

		_updateShippingAndCarrMoreOpt: function (bError) {
			// This block is used to update the shipping status and disable Execute buttons
			this._updateShippingStatus(bError);
			this._displayShipmentCarrierMoreOptTab();
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
							var aHUs = this.getModel("local").getProperty("/HandlingUnitLists");
							for (var j = 0; j < aHUs.length; j++) {
								if (aHUs[j].Outbhu === oObject.Outbhu) {
									if (parseFloat(sWeight) === parseFloat(oData.GetExternalScale.Weight)) {
										this.sHUWeightExtScaleChange = "";
									} else {
										this.sHUWeightExtScaleChange = oObject.Outbhu;
										aHUs[j].Weight = parseFloat(oData.GetExternalScale.Weight).toFixed(2);
										aHUs[j].Weightunit = oData.GetExternalScale.WeightUnit;
									}
									break;
								}
							}
							this.getModel("local").setProperty("/HandlingUnitLists", aHUs);
						}
						this.hideBusy();
					}.bind(this),
					error: function (oError) {
						this._handleODataError(oError);
						this.hideBusy();
					}.bind(this)
				});
			} else {
				var aHUs = this.getModel("local").getProperty("/HandlingUnitLists");
				for (var j = 0; j < aHUs.length; j++) {
					if (aHUs[j].Outbhu === oObject.Outbhu) {
						aHUs[j].Weight = parseFloat(this.iOriginalExtScaleWeight).toFixed(2);
						aHUs[j].Weightunit = this.sOriginalExtScaleWeightUnit;
					}
				}
				this.getModel("local").setProperty("/HandlingUnitLists", aHUs);
			}
		},

		onShowTrackingnumberPress: function (oEvent) {
			var oControl = oEvent.getSource();
			var oData = oControl.getBindingContext("local").getObject();
			var sTrackingNo = oData.Trackingnumber;
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
			this._getHazardous();
		},

		onHazardousClose: function (oEvent) {
			var oView = this.getView();
			var oNoOfContainer = this.byId(oView.createId("noOfContainerId"));
			oNoOfContainer.setValueState("None");
			MessageBox.confirm(this.oBundle.getText("CancelHazmatScreenButton"), {
				title: this.oBundle.getText("Confirm"),
				actions: [sap.m.MessageBox.Action.YES, sap.m.MessageBox.Action.NO],
				initialFocus: sap.m.MessageBox.Action.YES,
				onClose: function (oAction) {
					if (oAction === MessageBox.Action.YES) {
						// refesh hazmat
						var aHuRefesh = this.getModel("local").getProperty("/refreshHUS");
						this.bcheckHazmatupdate = true;
						var oDeferred = this._getHazardous();
						$.when(oDeferred).done(function () {
							this.hideBusy();
							this.getModel("local").setProperty("/HandlingUnitLists", aHuRefesh);
							MessageToast.show(this.oBundle.getText("Reset Hazardous Material successfully"));
							this.oHazmatDialog.close();
						}.bind(this));
					} else {
						this.oHazmatDialog.close();
					}
				}.bind(this)
			});
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
			this.idnumber = oData.Idnumber;
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
			this.aHazmatOptItems.forEach(function (item) {
				if (oBindingData.Idnumber === item.idnumber && oBindingData.Exidv === item.exidv) {
					oBinding.setProperty("/BindingHazmatOpt", item.Carropt.results);
				}
			});
			//handle data hazmat option
			this.handleHazmatOptionDataBeforeGenerate();
			//Binding hazmatoption
			this._getHazmatoptionAndTable();
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
				Idnumber: ""
			};
			this.getModel("local").setProperty("/NewHazMatItem", oNewHazmat);
			this.oHazmatAddItemDialog = Utils.getFragment("", "AddHazmatDialog", this);
			this.byId(this.getView().createId("cbDotnumber")).setSelectedKey("");
			this.byId(this.getView().createId("cbHuExidv")).setSelectedKey("");
			this.byId(this.getView().createId("cbDotnumber")).setValueState("None");
			this.oHazmatAddItemDialog.open();
		},

		onAddHazmatClose: function () {
			var oDataHazmat = this.getModel("local").getProperty("/FreightunitHazmats");
			var arrDataHazmat = [];
			oDataHazmat.forEach(function (item) {
				if (item.Selected !== "") {
					arrDataHazmat.push(item);
				}
			});
			this.getModel("local").setProperty("/FreightunitHazmats", arrDataHazmat);
			this.oHazmatAddItemDialog.close();
		},

		onHazmatAddItemPress: function () {
			var checkrequired = this.byId("cbDotnumber").getSelectedKey();
			if (checkrequired === '') {
				MessageBox.error(this.oBundle.getText("Field ID number not be empty"));
				this.byId("cbDotnumber").setValueState("Error");
				this.hideBusy();
				return;
			}
			var count = 0;
			var aFreightunitHazmats = this.getModel("local").getProperty("/FreightunitHazmats");
			var oNewHazmat = this.getModel("local").getProperty("/NewHazMatItem");
			var sTable = this.byId("cbHuExidv").getSelectedKey();
			aFreightunitHazmats.forEach(function (item) {
				if (item.Exidv === sTable) {
					count++;
				}
				if (count === 1) {
					oNewHazmat.DocumentId = item.DocumentId;
					// oNewHazmat.DocumentItemId = item.DocumentItemId;
					oNewHazmat.Propershipnam = "";
					oNewHazmat.Exidv = item.Exidv;
					aFreightunitHazmats.push(oNewHazmat);
				}
			});
			this.getModel("local").setProperty("/FreightunitHazmats", aFreightunitHazmats);
			MessageToast.show(this.oBundle.getText("AddUNIDSuccess"));
			this.oHazmatAddItemDialog.close();
			// this.validateADDUNID();
		},

		validateADDUNID: function () {
			var oRequest = this._generateValidateAddUNID();
			this.showBusy();
			this.getModel().create("/ShipmentQuerySet", oRequest, {
				success: function (OData) {
					MessageToast.show(this.oBundle.getText("AddUNIDSuccess"));
					this.oHazmatAddItemDialog.close();
					this.hideBusy();
				}.bind(this),
				error: function (oError) {
					this._handleODataError(oError);
					this.hideBusy();
				}.bind(this)
			});
		},

		_generateValidateAddUNID: function () {
			var aHandlingUnits = this._getSelectedHandlingUnits();
			var aHazmatUpdated = this.getModel("local").getProperty("/FreightunitHazmats");
			var BindingHU = this.getModel("local").getProperty("/BindingHU");
			var aHazmatItems = [];
			var aHazmat_Data = [];
			for (var j = 0; j < BindingHU.length; j++) {
				for (var k = 0; k < BindingHU[j].ItHazmat.results.length; k++) {
					if (BindingHU[j].ItHazmat.results[k].Exidv === BindingHU[j].exidv) {
						if (k < 1) {
							for (var l = 0; l < aHazmatUpdated.length; l++) {
								if (aHazmatUpdated[l].Exidv === BindingHU[j].exidv) {
									aHazmatItems.push(aHazmatUpdated[l]);
								}
							}
							aHazmat_Data.push({
								SelectedIds: [],
								FrtHazmat: [{
									ItHazmat: aHazmatItems,
									ItHazmatOption: [],
									exidv: BindingHU[j].exidv
								}]
							});
						}
					}
				}
				aHazmatItems = [];
			}
			var oData = {
				shipmentid: "",
				inputids: (this.sInputIDs) ? this.sInputIDs : "",
				inputtype: (this.sInputType) ? this.sInputType : "",
				ConsolidationSet: (this.aConsolidation) ? this.aConsolidation : [],
				profile: (this.sProfile) ? this.sProfile : "",
				warehousenum: (this.sWarehouseNumber) ? this.sWarehouseNumber : "",
				shippingstation: (this.sStation) ? this.sStation : "",
				action: "AddUNID",
				carrierMoreOption: [{
					valueList: []
				}],
				basic: this.getModel("local").getProperty("/basic"),
				HandlingUnits: this._handleHUSPayload(aHandlingUnits),
				Hazmat_Data: aHazmat_Data
			};
			return oData;
		},

		onPCDGunCBChange: function (oEvent) {
			var oControl = oEvent.getSource();
			var sKey = oControl.getSelectedKey();
			if (sKey === "") {
				return;
			}
			sKey = oControl.getSelectedItem().getBindingContext().getObject().Tkui + sKey;
			var sPropershipnam = oControl.getSelectedItem().getBindingContext().getObject().Propershipnam;
			var sPackinggroup = oControl.getSelectedItem().getBindingContext().getObject().Packinggroup;
			var sDgregulation = oControl.getSelectedItem().getBindingContext().getObject().Dgregulation;
			var sHazmatclass = oControl.getSelectedItem().getBindingContext().getObject().Hazmatclass;
			var sHazmatsubclass = oControl.getSelectedItem().getBindingContext().getObject().Hazmatsubclass;
			this.showBusy();
			this.getModel().callFunction("/GetSingleHazmat", {
				urlParameters: {
					HazmatID: sKey,
					Hazmatclass: sHazmatclass,
					Hazmatsubclass: sHazmatsubclass,
					Propershipnam: sPropershipnam,
					Packinggroup: sPackinggroup,
					Dgregulation: sDgregulation
				},
				success: function (oData) {
					oData.Idnumber = sKey;
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
				oNoOfContainer.setValueState("None");
				if (fActualQty === "") {
					fActualQty = 0;
					oActualQty.setValue(fActualQty);
				}
				// if (fNoOfConainer === "") {
				// 	fNoOfConainer = 0;
				// 	oNoOfContainer.setValue(fNoOfConainer);
				// } 
				if (fNoOfConainer < "1" || fNoOfConainer === "") {
					oNoOfContainer.setValueState("Error");
				} else if (fNoOfConainer !== "") {
					dResult = parseFloat(fActualQty, 10) * parseFloat(fNoOfConainer, 10);
				}

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
		onHazmatOptionChange: function (oEvent) {
			if (oEvent) {
				var sSelected = oEvent.getSource().getSelectedKey();
				this._updateHazmatOptionChange(oEvent.getSource().getBindingContext("local"), sSelected);
			}
		},
		_updateHazmatOptionChange: function (oBinding, sSelected) {
			var oData = oBinding.getObject();
			var sPath = oBinding.getPath();
			//Combobox
			oData.field_value = sSelected;
			this.getModel("local").setProperty(sPath, oData);
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
				var oPackMat;
				if (this.parentPackMat === "PackBundle") {
					oPackMat = sap.ui.getCore().byId("txtPackMatBundle");
				} else if (this.parentPackMat === "Repack") {
					oPackMat = sap.ui.getCore().byId("txtPackMatRepack");
				} else {
					oPackMat = sap.ui.getCore().byId("txtPackMat");
				}
				oPackMat.setValue(oSelectedItem.getTitle());
			}
			oEvent.getSource().getBinding("items").filter([]);
		},

		onReprint: function () {
			this.oReprintDialog = Utils.getFragment("", "ReprintDisplayDialog", this);
			var oReprintTemplate = sap.ui.xmlfragment("com.erpis.shiperp.hr7.parcelewm.fragment.ReprintColumnListItem", this);
			// var oFilter
			this.getModel("local").setProperty("/ReprintFilter", {
				Docno: ""
			});
			var oBindingInfo = {
				path: "/reprintHUSet",
				filters: [
					new Filter("Lgnum", "EQ", this.sWarehouseNumber)
				],
				template: oReprintTemplate
			};
			this.byId(this.getView().createId("tblReprintList")).bindItems(oBindingInfo);

			this.oReprintDialog.open();
			//*** add checkbox validator
			// this.byId(this.getView().createId("txtDeliveryPrint")).addValidator(function (args) {
			// 	var text = args.text;
			// 	return new Token({
			// 		key: text,
			// 		text: text
			// 	});
			// });
		},

		onCloseReprintDialog: function () {
			this.oReprintDialog.close();
		},

		onFilterReprintPress: function () {
			var aFilters = [];
			var oFilterCriteria = this.getModel("local").getProperty("/ReprintFilter");
			var oBinding = this.byId(this.getView().createId("tblReprintList")).getBinding("items");
			var oDateFormat = sap.ui.core.format.DateFormat.getDateInstance({
				pattern: "yyyy-MM-dd"
			});
			var sDateFrom = oDateFormat.format(this.byId("idInputDateRange").getDateValue());
			var sDateTo = oDateFormat.format(this.byId("idInputDateRange").getSecondDateValue());

			if (sDateFrom) {
				var oCarrierHollow = new Filter("Erdat", sap.ui.model.FilterOperator.GE, sDateFrom);
				var oCarrierData = new Filter("Erdat", sap.ui.model.FilterOperator.LE, sDateTo);
				aFilters.push(oCarrierHollow);
				aFilters.push(oCarrierData);
				var oFilterOR = new Filter({
					filters: aFilters,
					and: false
				});
				oBinding.filter(oFilterOR);
			} else {
				for (var sProperty in oFilterCriteria) {
					if (!oFilterCriteria.hasOwnProperty(sProperty)) {
						continue;
					}
					if (!oFilterCriteria[sProperty]) {
						continue;
					}

					switch (sProperty) {
					case "Objectkey":
						aFilters.push(new Filter(sProperty, sap.ui.model.FilterOperator.EQ, oFilterCriteria[sProperty]));
						break;
					default:
						aFilters.push(new Filter(sProperty, sap.ui.model.FilterOperator.EQ, oFilterCriteria[sProperty]));
						break;
					}
				}
				oBinding.filter(aFilters);
			}

		},
		_generateGetprintUsecase: function (oSelectedItem) {
			var arrData = [];
			for (var j = 0; j < oSelectedItem.length; j++) {
				var oItems = oSelectedItem[j].getBindingContext().getObject();
				arrData.push({
					LineItem: oItems.Lineitem,
					ObjectKey: oItems.Objectkey,
					ObjectType: oItems.Objecttype,
					ShipmentLabelSet: []
				});
				var oData = {
					Lgnum: this.sWarehouseNumber,
					Profile: this.sProfile,
					Shipstation: this.sStation,
					ReprintOutputSet: arrData
				};
			}
			return oData;
		},

		onConfirmReprint: function () {
			var oSelectedItem = this.byId(this.getView().createId("tblReprintList")).getSelectedItems();
			var oRequestData = this._generateGetprintUsecase(oSelectedItem);
			this.showBusy();
			this.getModel().create("/ReprintSet", oRequestData, {
				success: function (oData) {
					// Print Shipment Labels
					if (oData.ReprintOutputSet) {
						if (oData.ReprintOutputSet.results.length === 0) {
							MessageBox.error(this.oBundle.getText("NoPrintPreview"));
							this.hideBusy();
							return;
						} else {
							// var sPath;
							var contentType;
							var blob;
							var fileURL;
							for (var i = 0; i < oData.ReprintOutputSet.results.length; i++) {
								if (oData.ReprintOutputSet.results[i].ShipmentLabelSet.results.length > 0) {
									var shipmentLabelItem = oData.ReprintOutputSet.results[i].ShipmentLabelSet.results[0];
									if (shipmentLabelItem.OutputType === "PDF") {
										MessageToast.show(this.oBundle.getText("PrintSuccess"));
										var binary = atob(shipmentLabelItem.Output_Data.replace(/\s/g, ''));
										var len = binary.length;
										var buffer = new ArrayBuffer(len);
										var view = new Uint8Array(buffer);
										for (var j = 0; j < len; j++) {
											view[j] = binary.charCodeAt(j);
										}
										var blob = new Blob([view], {
											type: "application/pdf"
										});
										var url = URL.createObjectURL(blob);
										window.open(url);
									} else if (shipmentLabelItem.OutputType === "GIF") {
										contentType = 'image/gif';
										blob = this.b64toBlob(shipmentLabelItem.Output_Data, contentType);
										fileURL = URL.createObjectURL(blob);
										window.open(fileURL);
									} else {
										MessageBox.error(this.oBundle.getText("NoPrintPreview"));
										this.hideBusy();
										return;
									}
								} else {
									MessageBox.error(this.oBundle.getText("NoPrintPreview"));
									this.hideBusy();
									return;
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

		// onHandleReprintZPLDataType: function (sPath, bHideBusy) {
		// 	var fnSuccess = function (oData) {
		// 		console.log('ZPLII Handle Completed', oData); //eslint-disable-line
		// 		if (bHideBusy) {
		// 			this.hideBusy();
		// 		}

		// 	}.bind(this);
		// 	var fnError = function (oError) {
		// 		console.log('ZPLII Handle Err', oError); //eslint-disable-line
		// 		if (bHideBusy) {
		// 			this.hideBusy();
		// 		}
		// 	}.bind(this);
		// 	HttpHelper.getData(sPath, fnSuccess, fnError);
		// },

		onAnalysisDataFound: function (oEvent) {
			var iCount = oEvent.getSource().getItems().length;
			oEvent.getSource().setVisible(iCount !== 0);
		},
		/**
		 * (+) Remove the Print Preview button
		 * Modified by: Michael Ha
		 * Modified at: 03/01/2023
		 
		onPrintHazmat: function (oEvent) {
			this._printHazmat();
		},

		onPrintPreviewHazmat: function (oEvent) {
			this._printPreviewHazmat();
		},
		*/

		onCrossNavigate: function (oEvent) {
			var shellHash = oEvent.getSource().data("crossNavigate");
			if (!shellHash) {
				return;
			}
			this._setCookie("AppCancel", "EWM");
			this._setCookie("AppTrack", "EWM");
			if (sap.ushell && sap.ushell.Container && sap.ushell.Container.getServiceAsync) {
				sap.ushell.Container.getServiceAsync("CrossApplicationNavigation").then(function (xnavservice) {
					xnavservice.toExternal({
						target: {
							shellHash: shellHash
						}
					});
				}, function (oError) {
					jQuery.sap.log.error("Failed to get service", oError);
				});
			}
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
			var aHandlingUnits = this.getModel("local").getProperty("/HandlingUnitLists");
			for (var i = 0; i < aHandlingUnits.length; i++) {
				if (oObject.Outbhu === aHandlingUnits[i].Outbhu) {
					aHandlingUnits[i].Weight = oObject.Weight;
					aHandlingUnits[i].Weightunit = oObject.Weightunit;
					aHandlingUnits[i]["Laeng"] = oObject["Laeng"];
					aHandlingUnits[i].Width = oObject.Width;
					aHandlingUnits[i].Breit = oObject.Breit;
					// aHandlingUnits[i].dims_unit = oObject.dims_unit;
					this.getModel("local").setProperty("/HandlingUnitLists", aHandlingUnits);
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

		/* =========================================================== */
		/* internal methods                                            */
		/* =========================================================== */
		// Reset whole screen data
		_resetData: function () {
			this.byId("txtId").removeAllTokens();
			this.byId("btnHTS").setVisible(false);
			// // Enable inputs fields
			this.byId("txtId").setEditable(true);
			this.byId("cbInputType").setEnabled(true);
			this.getModel("local").setData({});

			this.byId("ObjectPageLayout").setShowHeaderContent(false);
			this.byId("ObjectPageLayout").setPreserveHeaderStateOnScroll(false);
			this.byId("iconTabCarrier").setVisible(false);
			this.byId("iconTabInternational").setVisible(false);
			this.byId("iconTabImporter").setVisible(false);

			this.hideBusy();
		},

		enableEditHandlingUnits: function (bEditable) {
			var aSelectedHUs = this.oHUTable.getItems();
			for (var i = 0; i < aSelectedHUs.length; i++) {
				this.enableEditHandlingUnit(aSelectedHUs[i], bEditable);
			}
		},

		enableEditHandlingUnit: function (oTableItem, bEditable) {
			// Make column weight editable
			oTableItem.getCells()[5].getItems()[0].setVisible(bEditable);
			oTableItem.getCells()[5].getItems()[1].setVisible(!bEditable);
			// Make column width editable
			oTableItem.getCells()[7].getItems()[0].setVisible(bEditable);
			oTableItem.getCells()[7].getItems()[1].setVisible(!bEditable);
			// Make column height editable
			oTableItem.getCells()[8].getItems()[0].setVisible(bEditable);
			oTableItem.getCells()[8].getItems()[1].setVisible(!bEditable);
			// H
			oTableItem.getCells()[9].getItems()[0].setVisible(bEditable);
			oTableItem.getCells()[9].getItems()[1].setVisible(!bEditable);
			// UoM
			oTableItem.getCells()[10].getItems()[0].setVisible(false);
			oTableItem.getCells()[10].getItems()[1].setVisible(true);
		},

		enableEditHandlingUnitsforExternalScale: function (bEditable) {
			var aSelectedHUs = this.oHUTable.getItems();
			for (var i = 0; i < aSelectedHUs.length; i++) {
				this.enableEditHandlingUnitforExternalScale(aSelectedHUs[i], bEditable);
			}
		},

		enableEditHandlingUnitforExternalScale: function (oTableItem, bEditable) {
			// Make column weight editable
			oTableItem.getCells()[4].getItems()[0].setVisible(false);
			oTableItem.getCells()[4].getItems()[1].setVisible(true);
			// Make column length editable
			oTableItem.getCells()[6].getItems()[0].setVisible(bEditable);
			oTableItem.getCells()[6].getItems()[1].setVisible(!bEditable);
			// Make column width editable
			oTableItem.getCells()[7].getItems()[0].setVisible(bEditable);
			oTableItem.getCells()[7].getItems()[1].setVisible(!bEditable);
			// Make column height editable
			oTableItem.getCells()[8].getItems()[0].setVisible(bEditable);
			oTableItem.getCells()[8].getItems()[1].setVisible(!bEditable);
			// Make column UoM editable
			// oTableItem.getCells()[8].getItems()[0].setVisible(bEditable);
			// oTableItem.getCells()[8].getItems()[1].setVisible(!bEditable);
			// edit button
			oTableItem.getCells()[10].getItems()[0].setPressed(bEditable);
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
						this.getModel("local").setProperty("/RateAnalysis", oData.DataAnalysis.results);
					} catch (exc) {
						this.getModel("local").setProperty("/RateAnalysis", []);
						this.oLogger.info("No Carrier Rate Analysis");
					}
					if (oData.return && oData.return.results.length > 0) {
						var aMsg = this._generateMessages(oData.return.results);
						this._addMessage(aMsg);
					}
					if (oData.HandlingUnits) {
						this.getModel("local").setProperty("/HandlingUnitLists", oData.HandlingUnits.results);
					}
					if (oData.ALVDataAnalysis) {
						this.getModel("local").setProperty("/ALVRateAnalysis", oData.ALVDataAnalysis.results);
					}
					if (!this.oRateAnalysisDialog) {
						this.oRateAnalysisDialog = sap.ui.xmlfragment("com.erpis.shiperp.hr7.parcelewm.fragment.RateAnalysisDialog", this);
						this.getView().addDependent(this.oRateAnalysisDialog);
					}
					this.getModel('local').setProperty('/rateTitle', true);
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
			var aHandlingUnits = [{
				carrierMoreOption: [{
					valueList: []
				}]
			}];
			if (this.getModel("local").getProperty("/HandlingUnitLists") && this.getModel("local").getProperty("/HandlingUnitLists").length > 0) {
				aHandlingUnits = this.getModel("local").getProperty("/HandlingUnitLists");
			}
			var oData = {
				shipmentid: "",
				inputids: (this.sInputIDs) ? this.sInputIDs : "",
				inputtype: (this.sInputType) ? this.sInputType : "",
				ConsolidationSet: (this.aConsolidation) ? this.aConsolidation : [],
				profile: (this.sProfile) ? this.sProfile : "",
				warehousenum: (this.sWarehouseNumber) ? this.sWarehouseNumber : "",
				shippingstation: (this.sStation) ? this.sStation : "",
				action: "GetRateAnalysis",
				carrierMoreOption: this.getModel("local").getProperty("/ShipmentCarrierOptions"),
				HandlingUnits: aHandlingUnits,
				basic: this.getModel("local").getProperty("/basic"),
				CarrierRates: [sap.ui.getCore().byId("tableRates").getSelectedItem().getBindingContext("local").getObject()],
				CarrierRateAnalysisSet: this.getModel("local").getProperty("/OrgCarrierRateAnalysis"),
				DataAnalysis: [],
				ALVDataAnalysis: [],
				return: []
			};
			return oData;
		},

		_getFreightCost: function (sWhichAction) {
			var oRequestData = this._generateGetFreightCostUsecase(sWhichAction);
			this.showBusy();
			this.getModel().create("/ShipmentQuerySet", oRequestData, {
				success: function (oData) {
					if (oData.basic.carrier_data.mps.mpstype) {
						this.getModel("local").setProperty("/basic/carrier_data/mps/mpstype", oData.basic.carrier_data.mps.mpstype);
					}
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
					if (oData.RateFreightUnits && oData.RateFreightUnits.results.length > 0) {
						this.getModel("local").setProperty("/RateFreightUnits", oData.RateFreightUnits.results);
					} else {
						this.getModel("local").setProperty("/RateFreightUnits", []);
					}
					if (!this.oRateDialog) {
						this.oRateDialog = sap.ui.xmlfragment("com.erpis.shiperp.hr7.parcelewm.fragment.RatesDialog", this);
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
				sActionName = "RateQuoteSingle";
			} else if (sWhichAction === "M") {
				sActionName = "RateQuoteMulti";
			} else if (sWhichAction === "R") {
				sActionName = "GetShopFreightCost";
			} else if (sWhichAction === "O") {
				sActionName = "GetOptimizationFreightCost";
			} else {
				sActionName = "GetSingleFreightCost";
			}
			this.handleCarrierMoreOptionDataBeforeGenerate();
			this.handleInternationlOptionDataBeforeGenerate();
			var aHandlingUnits = [];
			var aSelectedHUs = this._getSelectedHandlingUnits();
			var aHUList = this.getModel("local").getProperty("/HandlingUnitLists");
			for (var ii = 0; ii < aHUList.length; ii++) {
				aHUList[ii].Sel = '';
			}
			for (var i = 0; i < aHUList.length; i++) {
				for (var j = 0; j < aSelectedHUs.length; j++) {
					if (aHUList[i].Outbhu === aSelectedHUs[j].Outbhu) {
						aHUList[i].Sel = 'X';
						// aHandlingUnits.push(aHUList[i]);
					}
				}
				aHandlingUnits.push(aHUList[i]);
			}

			var aInternational = this.getModel("local").getProperty("/Internationaloptions");
			if (aInternational.length > 0) {
				aInternational.forEach(function (item) {
					if (typeof item.field_value2 !== "string") {
						item.field_value2 = JSON.stringify(item.field_value2);
					}
					if (typeof item.search_help !== "string") {
						item.search_help = JSON.stringify(item.search_help);
					}
					delete item.__metadata;
				})
			}

			var oData = {
				shipmentid: "",
				// References: this.getModel("local").getProperty("/References"),
				ConsolidationSet: (this.aConsolidation) ? this.aConsolidation : [],
				// HTS: this.getModel("local").getProperty("/HTS"),
				basic: this.getModel("local").getProperty("/basic"),
				shippingstation: (this.sStation) ? this.sStation : "",
				inputtype: (this.sInputType) ? this.sInputType : "",
				profile: (this.sProfile) ? this.sProfile : "",
				inputids: (this.sInputIDs) ? this.sInputIDs : "",
				warehousenum: (this.sWarehouseNumber) ? this.sWarehouseNumber : "",
				action: sActionName,
				carrierMoreOption: [{
					valueList: []
				}],
				HandlingUnits: this._handleHUSPayload(aHandlingUnits),
				CarrierRates: [],
				CarrierRateDetailSet: [],
				CarrierRatePricingSet: [],
				CarrierRateErrors: [],
				CarrierRateAnalysisSet: [],
				RateFreightUnits: [],
				internationalMoreOption: (aInternational) ? aInternational : []
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
					if (oData.HandlingUnits) {
						this.getModel("local").setProperty("/HandlingUnitLists", oData.HandlingUnits.results);
					} else {
						this.getModel("local").setProperty("/HandlingUnitLists", []);
					}
					if (oData.HandlingUnits) {
						this.getModel("local").setProperty("/HandlingUnitLists", oData.HandlingUnits.results);
					}
					this.oContentTable.removeSelections();
					this.oHUTable.removeSelections();
					// select next HU item if execute successfully.
					this._selectNextItem();
					//Hooks in Standard Controller for making controller extension
					if (this.afterGetTwoTable) {
						this.afterGetTwoTable(oData);
					}
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

			var aHandlingUnits = [{
				carrierMoreOption: [{
					valueList: []
				}]
			}];
			if (this.getModel("local").getProperty("/HandlingUnitLists") && this.getModel("local").getProperty("/HandlingUnitLists").length > 0) {
				aHandlingUnits = this.getModel("local").getProperty("/HandlingUnitLists");
			}
			var oData = {
				shipmentid: this.getModel("local").getProperty("/UseScale"),
				inputids: (this.sInputIDs) ? this.sInputIDs : "",
				inputtype: (this.sInputType) ? this.sInputType : "",
				ConsolidationSet: (this.aConsolidation) ? this.aConsolidation : [],
				profile: (this.sProfile) ? this.sProfile : "",
				warehousenum: (this.sWarehouseNumber) ? this.sWarehouseNumber : "",
				shippingstation: (this.sStation) ? this.sStation : "",
				action: sActionName,
				carrierMoreOption: this.getModel("local").getProperty("/ShipmentCarrierOptions"),
				basic: this.getModel("local").getProperty("/basic"),
				HandlingUnits: aHandlingUnits,
				Contents: [],
				HTS: this.getModel("local").getProperty("/HTS"),
				References: this.getModel("local").getProperty("/References"),
				CarrierRates: []
			};
			return oData;
		},

		_changeCarrier: function (sCarrier) {
			this.getModel("local").setProperty("/basic/carrier_data/carrier", sCarrier);
			this.getModel("local").setProperty("/basic/carrier_data/service", "");
			var oRequestData = this._generateChangeCarrierUsecase();
			this.showBusy();
			this.getModel().create("/ShipmentQuerySet", oRequestData, {
				success: function (oData) {
					this.hideBusy();
					if (oData.ServiceList.results) {
						this.getModel("local").setProperty("/ServiceList", oData.ServiceList.results);
					}
					if (oData.service) {
						this.getModel("local").setProperty("/basic/carrier_data/service", oData.service);
					}

					var aReferences = [];
					if (oData.References.results.length > 0) {
						oData.References.results.forEach(function (item) {
							aReferences.push(item);
						});
					}
					this.getModel("local").setProperty("/References", aReferences);

					/* Set international options */
					if (oData.internationalMoreOption.results.length > 0) {
						this.getModel("local").setProperty("/Internationaloptions", oData.internationalMoreOption.results);
						this._displayShipmentInternationOprionTab();
					}
					// if (oData.packagetype) {
					// 	this.getModel("local").setProperty("/basic/carrier_data/packagetype", oData.packagetype);
					// }
					if (oData.return && oData.return.results.length > 0) {
						var aMsg = this._generateMessages(oData.return.results);
						this._addMessage(aMsg);
					}
					if (oData.HandlingUnits) {
						this.getModel("local").setProperty("/HandlingUnitLists", oData.HandlingUnits.results);
					}
					// used to reupdate service id when selecting rate entry from the rate dialog
					if (this.sService !== "") {
						this.getModel("local").setProperty("/basic/carrier_data/service", this.sService);
						this.sService = "";
					}
					if (oData.carrierMoreOption && oData.carrierMoreOption.results) {
						this.getModel("local").setProperty("/ShipmentCarrierOptions", oData.carrierMoreOption.results);
					}
					this.getModel("local").setProperty("/basic/carrier_data/mps/mpstype", oData.basic.carrier_data.mps.mpstype);
					var oDeferredService = this._changeService(this.getModel("local").getProperty("/basic/carrier_data/service"));
					$.when(oDeferredService).done(function () {
						this.hideBusy();
						// Michael old logic backup
						// this._updateTermOfSale(sCarrier);
						this._displayTabs();
						this._updateShippingAndCarrMoreOpt();
						// Filter all the available dropdowns
						this._filterAllDropdowns();
						// display message strip header.
						this._displayMessageStripHeader();
					}.bind(this));

				}.bind(this),
				error: function (oError) {
					this._handleODataError(oError);
					this.hideBusy();
				}.bind(this)
			});
		},

		_generateChangeCarrierUsecase: function () {
			var oBasic = this.getModel("local").getProperty("/basic");
			var aHandlingUnits = [{
				carrierMoreOption: [{
					valueList: []
				}]
			}];
			if (this.getModel("local").getProperty("/HandlingUnitLists") && this.getModel("local").getProperty("/HandlingUnitLists").length > 0) {
				aHandlingUnits = this.getModel("local").getProperty("/HandlingUnitLists");
			}
			var oPayment = {
				"__metadata": oBasic["__metadata"],
				"payment": oBasic["payment"],
				"carrier_data": oBasic["carrier_data"]
			};

			var oData = {
				inputids: (this.sInputIDs) ? this.sInputIDs : "",
				carrierMoreOption: [{
					valueList: []
				}],
				warehousenum: (this.sWarehouseNumber) ? this.sWarehouseNumber : "",
				inputtype: (this.sInputType) ? this.sInputType : "",
				profile: (this.sProfile) ? this.sProfile : "",
				shippingstation: (this.sStation) ? this.sStation : "",
				action: "ChangeCarrier",
				basic: oPayment,
				service: "",
				packagetype: "",
				return: [],
				HandlingUnits: aHandlingUnits,
				ServiceList: [],
				References: [],
				internationalMoreOption: [{
					valueList: []
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
					if (oData.HandlingUnits) {
						this.getModel("local").setProperty("/HandlingUnitLists", oData.HandlingUnits.results);
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
			var aHandlingUnits = [{
				carrierMoreOption: [{
					valueList: []
				}]
			}];
			if (this.getModel("local").getProperty("/HandlingUnitLists") && this.getModel("local").getProperty("/HandlingUnitLists").length > 0) {
				aHandlingUnits = this.getModel("local").getProperty("/HandlingUnitLists");
			}
			var oData = {
				shipmentid: "",
				inputids: (this.sInputIDs) ? this.sInputIDs : "",
				inputtype: (this.sInputType) ? this.sInputType : "",
				ConsolidationSet: (this.aConsolidation) ? this.aConsolidation : [],
				profile: (this.sProfile) ? this.sProfile : "",
				warehousenum: (this.sWarehouseNumber) ? this.sWarehouseNumber : "",
				shippingstation: (this.sStation) ? this.sStation : "",
				action: "ChangeReturnService",
				HandlingUnits: aHandlingUnits,
				basic: this.getModel("local").getProperty("/basic"),
				carrierMoreOption: this.getModel("local").getProperty("/ShipmentCarrierOptions"),
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
			var oRequestData = this._generateCreateHUUsecase();
			this.getModel().create("/ShipmentQuerySet", oRequestData, {
				success: function (oData) {
					// this._refreshPackingData();
					if (oData.HandlingUnits) {
						this.getModel("local").setProperty("/HandlingUnitLists", oData.HandlingUnits.results);
					} else {
						this.getModel("local").setProperty("/HandlingUnitLists", []);
					}
					if (oData.HandlingUnitItemLists) {
						this.getModel("local").setProperty("/HUItemsList", oData.HandlingUnitItemLists.results);
					} else {
						this.getModel("local").setProperty("/HUItems", []);
					}
					if (oData.HandlingUnitPackDetails) {
						this.getModel("local").setProperty("/HUPackDetails", oData.HandlingUnitPackDetails.results);
					} else {
						this.getModel("local").setProperty("/HUPackDetails", []);
					}
					if (oData.HandlingUnits) {
						this.getModel("local").setProperty("/HandlingUnitLists", oData.HandlingUnits.results);
					}
					this._handleHUList();
					this._refreshData();
					this.oDialogNewHU.close();
					// var oDeferredFreightUnitExt = this.getFreightUnitExt();
					// $.when(oDeferredFreightUnitExt).done(function () {
					// 	this.getModel("local").setProperty("/HandlingUnitLists", oData.HandlingUnits.results);
					if (oData.return && oData.return.results.length > 0) {
						var aMsg = this._generateMessages(oData.return.results);
						this._addMessage(aMsg);
						if (aMsg.length > 0) this.byId('popoverButton').firePress();
					} else {
						MessageToast.show(this.oBundle.getText("CreateHUSuccess"));
					}
					this.hideBusy();
					// }.bind(this));
				}.bind(this),
				error: function (oError) {
					this._handleODataError(oError);
					this.oDialogNewHU.close();
					this.hideBusy();
				}.bind(this)
			});
		},

		_generateCreateHUUsecase: function () {
			var aHU = this.getModel("local").getProperty("/HandlingUnitLists");
			if (aHU && aHU.length > 0) {
				for (var i = 0; i < aHU.length; i++) {
					delete aHU[i].__metadata;
				}
			}

			var oData = {
				shipmentid: "",
				inputtype: (this.sInputType) ? this.sInputType : "",
				ConsolidationSet: (this.aConsolidation) ? this.aConsolidation : [],
				profile: (this.sProfile) ? this.sProfile : "",
				shippingstation: (this.sStation) ? this.sStation : "",
				// carrierMoreOption: this.getModel("local").getProperty("/ShipmentCarrierOptions"),
				inputids: (this.sInputIDs) ? this.sInputIDs : "",
				warehousenum: (this.sWarehouseNumber) ? this.sWarehouseNumber : "",
				action: "CreateHU",
				HandlingUnits: this._handleHUSPayload(aHU),
				HandlingUnitItemLists: [{
					HandlingUnitItems: []
				}],
				HandlingUnitPackDetails: [],
				PackScanner: [{
					DestPmatNo: sap.ui.getCore().byId("txtPackMat").getValue(),
					DestBin: sap.ui.getCore().byId("txtStorageBin").getValue(),
					NumberHus: sap.ui.getCore().byId("txtHUNo").getValue(),
					DestHuUi: '',
					Dstgrp: sap.ui.getCore().byId("txtConsGrp").getValue()
				}],
				return: []
			};
			return oData;
		},

		_deleteHUs: function (bAll) {
			var oRequestData = this._generateDeleteHUUsecase(bAll);
			if (oRequestData.HandlingUnits.length === 0) {
				MessageToast.show(this.oBundle.getText("noHUstodelete"));
				return;
			}
			this.showBusy();
			this.getModel().create("/ShipmentQuerySet", oRequestData, {
				success: function (oData) {
					if (oData.HandlingUnits) {
						this.getModel("local").setProperty("/HandlingUnitLists", oData.HandlingUnits.results);
					} else {
						this.getModel("local").setProperty("/HandlingUnitLists", []);
					}
					if (oData.Contents) {
						this.getModel("local").setProperty("/Contents", oData.Contents.results);
					} else {
						this.getModel("local").setProperty("/Contents", []);
					}
					if (oData.HandlingUnitItemLists) {
						this.getModel("local").setProperty("/HUItemsList", oData.HandlingUnitItemLists.results);
					} else {
						this.getModel("local").setProperty("/HUItems", []);
					}
					if (oData.HandlingUnitPackDetails) {
						this.getModel("local").setProperty("/HUPackDetails", oData.HandlingUnitPackDetails.results);
					} else {
						this.getModel("local").setProperty("/HUPackDetails", []);
					}
					if (oData.HandlingUnits) {
						this.getModel("local").setProperty("/HandlingUnitLists", oData.HandlingUnits.results);
					}
					this._handleHUList();
					this._refreshData();
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
			var sAction = "DeleteHU";
			// Get the selected HandlingUnitLists depending on the Packing scenario
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
				sAction = "DeleteAllHU";
				aSelectedHUs = oTable.getItems();
			} else {
				aSelectedHUs = oTable.getSelectedItems();
			}
			var aHandlingUnits = [];
			var aHUList = this.getModel("local").getProperty("/HandlingUnitLists");
			for (var i = 0; i < aHUList.length; i++) {
				for (var j = 0; j < aSelectedHUs.length; j++) {
					if (aHUList[i].Outbhu === aSelectedHUs[j].getBindingContext("local").getObject().Outbhu) {
						aHUList[i].Sel = 'X';
					}
					aHandlingUnits.push(aHUList[i]);
				}
			}

			var oData = {
				shipmentid: "",
				inputtype: (this.sInputType) ? this.sInputType : "",
				ConsolidationSet: (this.aConsolidation) ? this.aConsolidation : [],
				profile: (this.sProfile) ? this.sProfile : "",
				// carrierMoreOption: this.getModel("local").getProperty("/ShipmentCarrierOptions"),
				shippingstation: (this.sStation) ? this.sStation : "",
				inputids: (this.sInputIDs) ? this.sInputIDs : "",
				warehousenum: (this.sWarehouseNumber) ? this.sWarehouseNumber : "",
				action: sAction,
				basic: this.getModel("local").getProperty("/basic"),
				HandlingUnits: this._handleHUSPayload(aHandlingUnits),
				HandlingUnitItemLists: [{
					HandlingUnitItems: []
				}],
				HandlingUnitPackDetails: [],
				Contents: []
			};
			return oData;
		},

		_packPartial: function () {
			var oRequestData = this._generatePackPartialUsecase();
			this.showBusy();
			this.getModel().create("/ShipmentQuerySet", oRequestData, {
				success: function (oData) {
					// this._refreshPackingData(true);
					if (oData.HandlingUnits) {
						this.getModel("local").setProperty("/HandlingUnitLists", oData.HandlingUnits.results);
					} else {
						this.getModel("local").setProperty("/HandlingUnitLists", []);
					}
					if (oData.Contents) {
						this.getModel("local").setProperty("/Contents", oData.Contents.results);
					} else {
						this.getModel("local").setProperty("/Contents", []);
					}
					if (oData.HandlingUnitItemLists) {
						this.getModel("local").setProperty("/HUItemsList", oData.HandlingUnitItemLists.results);
					} else {
						this.getModel("local").setProperty("/HUItems", []);
					}
					if (oData.HandlingUnitPackDetails) {
						this.getModel("local").setProperty("/HUPackDetails", oData.HandlingUnitPackDetails.results);
					} else {
						this.getModel("local").setProperty("/HUPackDetails", []);
					}
					this._handleHUList();
					this._refreshData();
					MessageToast.show(this.oBundle.getText("PackPartialSuccess"));
					this.hideBusy();
				}.bind(this),
				error: function (oError) {
					this._handleODataError(oError);
					this.hideBusy();
				}.bind(this)
			});
		},

		_generatePackPartialUsecase: function () {
			var aSelectedItems = this.oContentTable.getSelectedItems();
			var aToteList = this.getModel("local").getProperty("/Contents");
			var aContents = [];
			var aHandlingUnits = [];
			var oTargetHU = this.oHUTable.getSelectedItems()[0].getBindingContext("local").getObject();
			var aHUList = this.getModel("local").getProperty("/HandlingUnitLists");
			for (var i = 0; i < aHUList.length; i++) {
				if (aHUList[i].Outbhu === oTargetHU.Outbhu) {
					aHUList[i].Sel = 'X';
				}
				aHandlingUnits.push(aHUList[i]);
			}
			for (var j = 0; j < aToteList.length; j++) {
				for (var k = 0; k < aSelectedItems.length; k++) {
					if (aToteList[j].GuidStock === aSelectedItems[k].getBindingContext("local").getObject().GuidStock) {
						aToteList[j].Sel = 'X';
					}
				}
				aContents.push(aToteList[j]);
			}
			var oData = {
				shipmentid: "",
				// basic: this.getModel("local").getProperty("/basic"),
				inputtype: (this.sInputType) ? this.sInputType : "",
				ConsolidationSet: (this.aConsolidation) ? this.aConsolidation : [],
				profile: (this.sProfile) ? this.sProfile : "",
				shippingstation: (this.sStation) ? this.sStation : "",
				// carrierMoreOption: this.getModel("local").getProperty("/ShipmentCarrierOptions"),
				inputids: (this.sInputIDs) ? this.sInputIDs : "",
				warehousenum: (this.sWarehouseNumber) ? this.sWarehouseNumber : "",
				action: "PackPartial",
				HandlingUnits: this._handleHUSPayload(aHandlingUnits),
				HandlingUnitItemLists: [{
					HandlingUnitItems: []
				}],
				HandlingUnitPackDetails: [],
				Contents: aContents
			};
			return oData;
		},

		_packMaterial: function () {
			this.showBusy();
			var oRequestData = this._generatePackMaterialUsecase();
			this.getModel().create("/ShipmentQuerySet", oRequestData, {
				success: function (oData) {
					if (oData.HandlingUnits) {
						this.getModel("local").setProperty("/HandlingUnitLists", oData.HandlingUnits.results);
					} else {
						this.getModel("local").setProperty("/HandlingUnitLists", []);
					}
					if (oData.Contents) {
						this.getModel("local").setProperty("/Contents", oData.Contents.results);
					} else {
						this.getModel("local").setProperty("/Contents", []);
					}
					if (oData.HandlingUnitItemLists) {
						this.getModel("local").setProperty("/HUItemsList", oData.HandlingUnitItemLists.results);
					} else {
						this.getModel("local").setProperty("/HUItems", []);
					}
					if (oData.HandlingUnitPackDetails) {
						this.getModel("local").setProperty("/HUPackDetails", oData.HandlingUnitPackDetails.results);
					} else {
						this.getModel("local").setProperty("/HUPackDetails", []);
					}
					this._handleHUList();
					this._refreshData();
					MessageToast.show(this.oBundle.getText("PackMaterialSuccess"));
				}.bind(this),
				error: function (oError) {
					this._handleODataError(oError);
					this.hideBusy();
				}.bind(this)
			});
		},

		_packBundle: function () {
			this.showBusy();
			var oRequestData = this._generatePackBundleUsecase();
			this.getModel().create("/ShipmentQuerySet", oRequestData, {
				success: function (oData) {
					if (oData.HandlingUnits) {
						this.getModel("local").setProperty("/HandlingUnitLists", oData.HandlingUnits.results);
					} else {
						this.getModel("local").setProperty("/HandlingUnitLists", []);
					}
					if (oData.Contents) {
						this.getModel("local").setProperty("/Contents", oData.Contents.results);
					} else {
						this.getModel("local").setProperty("/Contents", []);
					}
					if (oData.HandlingUnitItemLists) {
						this.getModel("local").setProperty("/HUItemsList", oData.HandlingUnitItemLists.results);
					} else {
						this.getModel("local").setProperty("/HUItems", []);
					}
					if (oData.HandlingUnitPackDetails) {
						this.getModel("local").setProperty("/HUPackDetails", oData.HandlingUnitPackDetails.results);
					} else {
						this.getModel("local").setProperty("/HUPackDetails", []);
					}

					this._handleHUList();
					this._refreshData();
					MessageToast.show(this.oBundle.getText("PackMaterialSuccess"));
					this.hideBusy();
					this.oPackBundleDialog.close();
				}.bind(this),
				error: function (oError) {
					this._handleODataError(oError);
					this.hideBusy();
				}.bind(this)
			});
		},

		_refreshData: function () {
			this.oHUTable.removeSelections();
			// select next HU item if execute successfully.
			this._selectNextItem();
			//Hooks in Standard Controller for making controller extension
			if (this.afterGetTwoTable) {
				this.afterGetTwoTable(oData);
			}
			this._updateShippingAndCarrMoreOpt();
			this.hideBusy();
		},
		_generatePackMaterialUsecase: function () {
			var aSelectedItems = this.oContentTable.getSelectedItems();
			var aToteList = this.getModel("local").getProperty("/Contents");
			var aContents = [];
			var aHandlingUnits = [];
			var oTargetHU = this.oHUTable.getSelectedItems()[0].getBindingContext("local").getObject();
			var aHUList = this.getModel("local").getProperty("/HandlingUnitLists");
			for (var i = 0; i < aHUList.length; i++) {
				if (aHUList[i].Outbhu === oTargetHU.Outbhu) {
					aHUList[i].Sel = 'X';
				}
				aHandlingUnits.push(aHUList[i]);
			}
			for (var j = 0; j < aToteList.length; j++) {
				for (var k = 0; k < aSelectedItems.length; k++) {
					if (aToteList[j].GuidStock === aSelectedItems[k].getBindingContext("local").getObject().GuidStock) {
						aToteList[j].Sel = 'X';
					}
					aToteList[j].Partialqty = aToteList[j].Partialqty + "";
					aContents.push(aToteList[j]);
				}
			}

			var oData = {
				shipmentid: "",
				inputtype: (this.sInputType) ? this.sInputType : "",
				ConsolidationSet: (this.aConsolidation) ? this.aConsolidation : [],
				profile: (this.sProfile) ? this.sProfile : "",
				shippingstation: (this.sStation) ? this.sStation : "",
				// carrierMoreOption: this.getModel("local").getProperty("/ShipmentCarrierOptions"),
				// basic: this.getModel("local").getProperty("/basic"),
				inputids: (this.sInputIDs) ? this.sInputIDs : "",
				warehousenum: (this.sWarehouseNumber) ? this.sWarehouseNumber : "",
				action: "PackMaterial",
				HandlingUnits: this._handleHUSPayload(aHandlingUnits),
				HandlingUnitItemLists: [{
					HandlingUnitItems: []
				}],
				HandlingUnitPackDetails: [],
				Contents: aContents
			};
			return oData;
		},

		_generatePackBundleUsecase: function () {
			var aSelectedItems = this.oContentTable.getSelectedItems();
			var aToteList = this.getModel("local").getProperty("/Contents");
			var aContents = [];
			var aHandlingUnits = [];
			var aHUList = this.getModel("local").getProperty("/HandlingUnitLists");
			aHandlingUnits = aHUList;
			for (var j = 0; j < aToteList.length; j++) {
				for (var k = 0; k < aSelectedItems.length; k++) {
					if (aToteList[j].GuidStock === aSelectedItems[k].getBindingContext("local").getObject().GuidStock) {
						aToteList[j].Sel = 'X';
					}
					aToteList[j].Partialqty = aToteList[j].Partialqty + "";
					aContents.push(aToteList[j]);
				}
			}

			var oData = {
				shipmentid: "",
				shippingstation: (this.sStation) ? this.sStation : "",
				inputtype: (this.sInputType) ? this.sInputType : "",
				// carrierMoreOption: this.getModel("local").getProperty("/ShipmentCarrierOptions"),
				ConsolidationSet: (this.aConsolidation) ? this.aConsolidation : [],
				profile: (this.sProfile) ? this.sProfile : "",
				// basic: this.getModel("local").getProperty("/basic"),
				inputids: (this.sInputIDs) ? this.sInputIDs : "",
				warehousenum: (this.sWarehouseNumber) ? this.sWarehouseNumber : "",
				action: "PackBundle",
				HandlingUnits: this._handleHUSPayload(aHandlingUnits),
				HandlingUnitItemLists: [{
					HandlingUnitItems: []
				}],
				HandlingUnitPackDetails: [],
				Contents: aContents,
				PackScanner: [{
					DestPmatNo: sap.ui.getCore().byId("txtPackMatBundle").getValue(),
					DestBin: sap.ui.getCore().byId("txtStorageBinBundle").getValue(),
					NumberHus: "1",
					DestHuUi: '',
					Dstgrp: sap.ui.getCore().byId("txtConsGrpBundle").getValue()
				}]
			};
			return oData;
		},

		_unpack: function (aSelectedHUs, aSelectHUItems) {
			this.showBusy();
			var oRequestData = this._generateUnpackUsecase(aSelectHUItems);
			this.getModel().create("/ShipmentQuerySet", oRequestData, {
				success: function (oData) {
					if (oData.HandlingUnits) {
						this.getModel("local").setProperty("/HandlingUnitLists", oData.HandlingUnits.results);
					} else {
						this.getModel("local").setProperty("/HandlingUnitLists", []);
					}
					if (oData.Contents) {
						this.getModel("local").setProperty("/Contents", oData.Contents.results);
					} else {
						this.getModel("local").setProperty("/Contents", []);
					}
					if (oData.HandlingUnitItemLists) {
						this.getModel("local").setProperty("/HUItemsList", oData.HandlingUnitItemLists.results);
					} else {
						this.getModel("local").setProperty("/HUItems", []);
					}
					if (oData.HandlingUnitPackDetails) {
						this.getModel("local").setProperty("/HUPackDetails", oData.HandlingUnitPackDetails.results);
					} else {
						this.getModel("local").setProperty("/HUPackDetails", []);
					}
					this._handleHUList();
					this._refreshData();
					if (oData.return && oData.return.results.length > 0) {
						var aMsg = this._generateMessages(oData.return.results);
						this._addMessage(aMsg);
					}
					// if (aSelectHUItems && aSelectHUItems.length > 0) {
					// 	var oDeferredFreightUnitExt = this.getFreightUnitExt();
					// 	$.when(oDeferredFreightUnitExt).done(function () {
					// 		this.hideBusy();
					// 		this._showPackingOverview(parseInt(aSelectedHUs[0].Outbhu, 10), "06");
					// 		MessageToast.show(this.oBundle.getText("UnpackSuccess"));
					// 	}.bind(this));
					// }
				}.bind(this),
				error: function (oError) {
					this._handleODataError(oError);
					this.hideBusy();
				}.bind(this)
			});
		},

		_generateUnpackUsecase: function (aItemUnpack) {
			var aHandlingUnits = [];
			var aHUPackList = [];
			var bUnpackAll = true;
			var oHUPack = {};
			var aSelectedItems = this.oContentTable.getSelectedItems();
			var aToteList = this.getModel("local").getProperty("/Contents");
			var aContents = [];
			if (aItemUnpack && aItemUnpack.length > 0) {
				aHandlingUnits = this.aHUPackOverView;
				for (var a = 0; a < aItemUnpack.length; a++) {
					oHUPack = aItemUnpack[a].getBindingContext("local").getObject();
					aHUPackList.push(oHUPack);
					// aHUPackList.push({
					// 	"handlingUnit": oHUPack.handlingUnit,
					// 	"parentHandlingUnit": oHUPack.parentHandlingUnit,
					// 	"itemFlag": oHUPack.itemFlag,
					// 	"guidParent": oHUPack.guidParent,
					// 	"guidStock": oHUPack.guidStock,
					// 	"material": oHUPack.material,
					// 	"materialDescription": oHUPack.materialDescription,
					// 	"documentNumber": oHUPack.documentNumber,
					// 	"itemNumber": oHUPack.itemNumber,
					// 	"quantity": oHUPack.quantity,
					// 	"unit": oHUPack.unit,
					// 	"nmfcCode": oHUPack.nmfcCode,
					// 	"freightClass": oHUPack.freightClass
					// });
				}
				bUnpackAll = false;
			} else {
				var oTargetHU = this.oHUTable.getSelectedItems()[0].getBindingContext("local").getObject();
				var aHUList = this.getModel("local").getProperty("/HandlingUnitLists");
				for (var i = 0; i < aHUList.length; i++) {
					if (aHUList[i].Outbhu === oTargetHU.Outbhu) {
						aHUList[i].Sel = 'X';
					}
					aHandlingUnits.push(aHUList[i]);
				}
			}
			for (var j = 0; j < aToteList.length; j++) {
				for (var k = 0; k < aSelectedItems.length; k++) {
					if (aToteList[j].GuidStock === aSelectedItems[k].getBindingContext("local").getObject().GuidStock) {
						aToteList[j].Sel = 'X';
					}
					aToteList[j].Partialqty = aToteList[j].Partialqty + "";
					aContents.push(aToteList[j]);
				}
			}
			var oData = {
				shipmentid: "",
				inputtype: (this.sInputType) ? this.sInputType : "",
				ConsolidationSet: (this.aConsolidation) ? this.aConsolidation : [],
				profile: (this.sProfile) ? this.sProfile : "",
				basic: this.getModel("local").getProperty("/basic"),
				shippingstation: (this.sStation) ? this.sStation : "",
				inputids: (this.sInputIDs) ? this.sInputIDs : "",
				warehousenum: (this.sWarehouseNumber) ? this.sWarehouseNumber : "",
				action: "UnpackHU",
				all: bUnpackAll,
				HandlingUnits: this._handleHUSPayload(aHandlingUnits),
				HandlingUnitItemLists: [{
					HandlingUnitItems: []
				}],
				HandlingUnitPackDetails: aHUPackList,
				Contents: aContents
			};
			return oData;
		},
		/**
		 * Execute Ship button
		 * */
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
				description: "",
				counter: 0
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
		_addMessage: function (aMsg) {
			var aMessages = this.getModel("messageModel").getProperty("/aMessages");
			var aNewMessages = aMsg.concat(aMessages);
			this.getModel("messageModel").setProperty("/messagesLength", aNewMessages.length);
			this.getModel("messageModel").setProperty("/aMessages", aNewMessages);
		},
		_execute: function () {
			var oRequestData = this._generateExecuteUsecase();
			var oHUTab = this.oHUTable;
			// var sMps = this.getModel("local").getProperty("/basic/carrier_data/mps/mps");
			var sMpsType = this.getModel("local").getProperty("/basic/carrier_data/mps/mpstype");
			if (!(sMpsType === "02")) { // is single
				this.oSelectedHu = oHUTab.getSelectedItem();
			}
			this.showBusy();
			this.getModel().create("/ShipmentQuerySet", oRequestData, {
				success: function (oData, oResponse) {
					// this._refreshPackingData();
					var bHasErrorMessCheck = false;
					if (oData.return.results.length > 0) {
						var aMsg = this._generateMessages(oData.return.results);
						this._addMessage(aMsg);
						for (var i = 0; i < aMsg.length; i++) {
							if (aMsg[i].type == "Error") {
								bHasErrorMessCheck = true;
							}
						}
						if (aMsg.length > 0) this.byId('popoverButton').firePress();
					}
					if (oData.HandlingUnits) {
						this.getModel("local").setProperty("/HandlingUnitLists", oData.HandlingUnits.results);
					}
					// if (!bHasErrorMessCheck) {
					// this._refreshData();
					var oBasicData = this.getModel("local").getProperty("/basic");
					this.getModel("local").setProperty("/basic/carrier_data/mps/mpstype", oData.basic.carrier_data.mps.mpstype);
					// Tracking Data
					var oTracking = {};
					if (oData.ShipmentReturnSet.results.length > 0) {
						oTracking = oData.ShipmentReturnSet.results[oData.ShipmentReturnSet.results.length - 1];
					}
					if (oData.HandlingUnits) {

						var checkShipment = this.getModel("local").getProperty("/HandlingUnitLists");
						oData.HandlingUnits.results.forEach(function (itemship) {
							checkShipment.forEach(function (items) {
								if (items.Outbhu === itemship.Outbhu) {
									items.Trackingnumber = itemship.Trackingnumber;
									items.Sel = itemship.Sel;
								}
							});
						});
						this.getModel("local").setProperty("/HandlingUnitLists", checkShipment);
					}
					// Previous Shipment
					var oPreviousShipment = {
						carrier: oBasicData.carrier_data.carrier,
						service: oBasicData.carrier_data.service,
						billing_option: oBasicData.payment.billing_option,
						shipment_date: oBasicData.date_time.shipment_date,
						weight: oTracking.Totaldimweight,
						rate: oTracking.Rate,
						trackingno: oTracking.Mastertrack
					};
					this.getModel("local").setProperty("/PreviousShipment", oPreviousShipment);
					this._handleHUList();
					this._refreshData();
					if (parseInt(oTracking.Mastertrack, 10) > 0) {
						MessageToast.show(this.oBundle.getText("ExecuteSuccess", [oTracking.Mastertrack]));
					}

					// Print Shipment Labels
					if (oData.OutputListSet) {
						if (oData.OutputListSet.results.length === 0) {
							MessageBox.error(this.oBundle.getText("NoPrintPreview"));
						}
						var contentType;
						var blob;
						var fileURL;
						// var convString;
						// var b64Data;
						for (var b = 0; b < oData.OutputListSet.results.length; b++) {
							var shipmentLabelItem = oData.OutputListSet.results[b];
							if (shipmentLabelItem.Outputtype === "PDF") {
								MessageToast.show(this.oBundle.getText("PrintSuccess"));
								var binary = atob(shipmentLabelItem.Output.replace(/\s/g, ''));
								var len = binary.length;
								var buffer = new ArrayBuffer(len);
								var view = new Uint8Array(buffer);
								for (i = 0; i < len; i++) {
									view[i] = binary.charCodeAt(i);
								}
								var blob = new Blob([view], {
									type: "application/pdf"
								});
								var url = URL.createObjectURL(blob);
								window.open(url);
							} else if (shipmentLabelItem.Outputtype === "GIF") {
								contentType = 'image/gif';
								blob = this.b64toBlob(shipmentLabelItem.Output, contentType);
								fileURL = URL.createObjectURL(blob);
								window.open(fileURL);
							}
						}
					}
					//Michael Fix Print EWM
					// Print Shipment Labels
					// if (oData.ShipmentLabelSet) {
					// 	if (oData.ShipmentLabelSet.results.length === 0) {
					// 		// MessageBox.error(this.oBundle.getText("NoPrintPreview"));
					// 	} else {
					// 		var sPath;
					// 		for (var b = 0; b < oData.ShipmentLabelSet.results.length; b++) {
					// 			var shipmentLabelItem = oData.ShipmentLabelSet.results[b];
					// 			sPath = this.getModel().sServiceUrl + "/ShipmentLabelSet(shipmentid='',Guid='" + shipmentLabelItem.Guid +
					// 				"')/$value";
					// 			//Handle ZPL Axo 4780
					// 			if (shipmentLabelItem.OutputType.indexOf("ZPLII") !== -1) {
					// 				this.onHandleReprintZPLDataType(sPath, false);
					// 				// return;
					// 			} else {
					// 				//other type download
					// 				sap.m.URLHelper.redirect(sPath, true);
					// 			}

					// 		}
					// 	}
					// }
					// this._handleOdataResponse(oResponse);
					this.hideBusy();
				}.bind(this),
				error: function (oError) {
					this.oSelectedHu = null;
					this._handleODataError(oError);
					this.hideBusy();
				}.bind(this)
			});
		},

		hexToBase64: function (str) {
			var bString = "";
			for (var i = 0; i < str.length; i += 2) {
				bString += String.fromCharCode(parseInt(str.substr(i, 2), 16));
			}
			return btoa(bString);
		},

		b64toBlob: function (b64Data, contentType, sliceSize) {
			contentType = contentType || '';
			sliceSize = sliceSize || 512;
			var byteCharacters = atob(b64Data);
			var byteArrays = [];
			for (var offset = 0; offset < byteCharacters.length; offset += sliceSize) {
				var slice = byteCharacters.slice(offset, offset + sliceSize);
				var byteNumbers = new Array(slice.length);
				for (var i = 0; i < slice.length; i++) {
					byteNumbers[i] = slice.charCodeAt(i);
				}
				var byteArray = new Uint8Array(byteNumbers);
				byteArrays.push(byteArray);
			}
			var blob = new Blob(byteArrays, {
				type: contentType
			});
			return blob;
		},

		_selectNextItem: function () {
			if (!this.oSelectedHu) {
				return;
			}
			var oHUTab = this.oHUTable;
			var aHUItems = oHUTab.getItems();
			var iSelectedIndex = -1;

			aHUItems.forEach(function (item, index) {
				if (item.getBindingContext("local").getObject().Outbhu === this.oSelectedHu.getBindingContext("local").getObject().Outbhu) {
					iSelectedIndex = index;
					return;
				}
			}.bind(this));
			if (iSelectedIndex < 0) {
				return;
			}
			for (var i = iSelectedIndex + 1; i < aHUItems.length; i++) {
				var oItemData = aHUItems[i].getBindingContext("local").getObject();
				if (oItemData.Trackingnumber === "") {
					aHUItems[i].setSelected(true);
					return;
				}
			}
			// remove selection list
			this.oSelectedHu = null;
		},

		_generateExecuteUsecase: function () {
			var sMPSType = this.getModel("local").getProperty("/basic/carrier_data/mps/mpstype");
			var aHUList = this.getModel("local").getProperty("/HandlingUnitLists");
			var aSelectedHUs = this._getSelectedHandlingUnits();
			for (var i = 0; i < aHUList.length; i++) {
				for (var j = 0; j < aSelectedHUs.length; j++) {
					if (aHUList[i].Outbhu === aSelectedHUs[j].Outbhu) {
						aHUList[i].Sel = 'X';
					}
				}
			}

			this.handleCarrierMoreOptionDataBeforeGenerate();
			this.handleInternationlOptionDataBeforeGenerate();
			var HUSList = this._handleHUSPayload(aHUList);
			var aHandlingUnits = [{
				carrierMoreOption: [{
					valueList: []
				}]
			}];
			if (this.getModel("local").getProperty("/HandlingUnitLists") && this.getModel("local").getProperty("/HandlingUnitLists").length > 0) {
				aHandlingUnits = this.getModel("local").getProperty("/HandlingUnitLists");
			}
			aHandlingUnits.forEach(function (items) {
				items.carrierMoreOption.results.forEach(function (obj) {
					if (typeof obj.field_value2 !== "string") {
						obj.field_value2 = JSON.stringify(obj.field_value2);
						obj.search_help = JSON.stringify(obj.search_help);
					}
				})
			})
			var aInternational = this.getModel("local").getProperty("/Internationaloptions");
			if (aInternational.length > 0) {
				aInternational.forEach(function (item) {
					if (typeof item.field_value2 !== "string") {
						item.field_value2 = JSON.stringify(item.field_value2);
						item.search_help = JSON.stringify(item.search_help);
					}
					delete item.__metadata;
				})
			}
			var acarrierMoreOption = this.getModel("local").getProperty("/ShipmentCarrierOptions");
			acarrierMoreOption.forEach(function (obj) {
				if (typeof obj.field_value2 !== "string") {
					obj.field_value2 = JSON.stringify(obj.field_value2);
					obj.search_help = JSON.stringify(obj.search_help);
				}
			})
			var oBasic = this.getModel("local").getProperty("/basic")
			this.spackage_type = oBasic.misc.package_type;
			var aHazmat_Data = this.getModel("local").getProperty("/HazmatData");
			var oData = {
				shipmentid: "",
				inputids: (this.sInputIDs) ? this.sInputIDs : "",
				inputtype: (this.sInputType) ? this.sInputType : "",
				packagetype: (this.spackage_type) ? this.spackage_type : "",
				carrier: (this.sCarrier) ? this.sCarrier : "",
				ConsolidationSet: (this.aConsolidation) ? this.aConsolidation : [],
				profile: (this.sProfile) ? this.sProfile : "",
				warehousenum: (this.sWarehouseNumber) ? this.sWarehouseNumber : "",
				shippingstation: (this.sStation) ? this.sStation : "",
				action: "CreateShipment",
				basic: this.getModel("local").getProperty("/basic"),
				carrierMoreOption: this.getModel("local").getProperty("/ShipmentCarrierOptions"),
				HandlingUnits: aHandlingUnits,
				HTS: this.getModel("local").getProperty("/HTS"),
				References: this.getModel("local").getProperty("/References"),
				ShipmentReturnSet: [],
				return: [],
				OutputListSet: [],
				ShipmentLabelSet: [],
				Hazmat_Data: (aHazmat_Data) ? aHazmat_Data : [],
				internationalMoreOption: (aInternational) ? aInternational : [],
				NaftaDetailSet: this.getModel("local").getProperty("/NaftaDetailSet")
			};
			return oData;
		},

		_filterAllDropdowns: function () {
			/****************      PARCEL TAB    ************/
			// Filter the Carrier Service Dropdown based on Carrier
			var oSelectService = this.byId("selectService");
			oSelectService.getBinding("items").filter(new Filter("carrier", "EQ", this.sCarrier));
			// Filter the Package Type Dropdown based on Carrier
			this.byId("selectPackage").getBinding("items").filter(new Filter("Carrier", "EQ", this.sCarrier));

			/****************  SHIP FROM/TO + SOLD TO TAB   **************/
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

			/****************    INTERNATIONAL TAB   *****************/
			// Filter dropdowns based on domestic or international flag
			if (!this.getModel("local").getProperty("/basic/shipment_flags/domestic")) {
				// Filter the Importer Region Dropdown based on Country
				var oImporterStateSel = this.byId("slImporterState");
				oImporterStateSel.getBinding("items").filter(new Filter("Country", "EQ", this.getModel("local").getProperty(
					"/basic/partners/importer/address/country")));
				oImporterStateSel.getBinding("items").attachDataReceived(function () {
					oImporterStateSel.setSelectedKey(this.getModel("local").getProperty("/basic/partners/importer/address/state"));
				}.bind(this), this);
				if (this.sCarrier === "UPS") {
					this.byId("cbUPSTermOfSale").getBinding("items").filter(new Filter("Carrier", "EQ", this.sCarrier));
					this.byId("cbUPSSalePurpose").getBinding("items").filter(new Filter("Carrier", "EQ", this.sCarrier));
					this.byId("cbUPSRegulatoryControl").getBinding("items").filter(new Filter("Carrier", "EQ", this.sCarrier));
					this.byId("cbUPSTinType").getBinding("items").filter(new Filter("Carrier", "EQ", this.sCarrier));
					this.byId("cbBillingOption").getBinding("items").filter(new Filter("Carrier", "EQ", this.sCarrier));
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
				this.getModel("local").setProperty("/basic/declared", "");
				this.byId("iddeclared").setEnabled(false);
				this.byId("iconTabInternational").setVisible(false);
				this.byId("iconTabImporter").setVisible(false);
				this.byId("btnHTS").setVisible(false);
			} else {
				this.byId("iddeclared").setEnabled(true);
				this.byId("iconTabInternational").setVisible(true);
				this.byId("iconTabImporter").setVisible(true);
				this.byId("btnHTS").setVisible(true);
			}

		},
		_displayShipmentCarrierMoreOptTab: function () {
			var aCarrierMoreOptions = this.getModel("local").getProperty("/ShipmentCarrierOptions");
			var aShipmentCarrierMoreOptions = this._convertStringtoJson(aCarrierMoreOptions);
			if (aShipmentCarrierMoreOptions && aShipmentCarrierMoreOptions.length > 0) {
				// Carrier specific Tab
				this.oShipmentCarrierOptionTab = this.byId("iconTabCarrierSub");
				this.byId("iconTabCarrier").setVisible(true);
				this.oShipmentCarrierOptionTab.setTitle(this.getModel("local").getProperty("/basic/carrier_data/carrier"));
				this._generateShipmentCarrierMoreOption(aShipmentCarrierMoreOptions, this.oShipmentCarrierOptionTab);
			}
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
			if (oSelectedSerialMaster.SerialItemSet.results.length < parseInt(oSelectedSerialMaster.quantity, 10)) {
				var iNumberItemToAdd = parseInt(oSelectedSerialMaster.quantity, 10) - parseInt(oSelectedSerialMaster.serial_count, 10);

				for (var i = 0; i < iNumberItemToAdd; i++) {
					var oSerial = {
						SERNR: "",
						POSNR: oSelectedSerialMaster.itemno,
						VBELN: oSelectedSerialMaster.docno,
						shipmentid: ""
					};
					oSelectedSerialMaster.SerialItemSet.results.push(oSerial);
				}
			}
			this.getModel("local").setProperty("/SelectedSerial", oSelectedSerialMaster);
		},

		_generateValidateAddressUsecase: function () {
			var oData = {
				shipmentid: "",
				inputids: (this.sInputIDs) ? this.sInputIDs : "",
				inputtype: (this.sInputType) ? this.sInputType : "",
				ConsolidationSet: (this.aConsolidation) ? this.aConsolidation : [],
				profile: (this.sProfile) ? this.sProfile : "",
				warehousenum: (this.sWarehouseNumber) ? this.sWarehouseNumber : "",
				shippingstation: (this.sStation) ? this.sStation : "",
				action: 'ValidateAddress',
				carrierMoreOption: [{
					valueList: []
				}],
				basic: this.getModel("local").getProperty("/basic"),
				HandlingUnits: this._handleHUSPayload(this.getModel("local").getProperty("/HandlingUnitLists")),
				HTS: this.getModel("local").getProperty("/HTS"),
				References: this.getModel("local").getProperty("/References"),
				return: [],
				ValAddressSet: [],
				avalreturn: {}
			};
			return oData;
		},

		_generatePostSerialsUsecase: function () {
			var sActionName = "PostSerials";
			var aMasterList = this.getModel("local").getProperty("/MasterSerialList");
			var aHandlingUnits = [{
				carrierMoreOption: [{
					valueList: []
				}]
			}];
			if (this.getModel("local").getProperty("/HandlingUnitLists") && this.getModel("local").getProperty("/HandlingUnitLists").length > 0) {
				aHandlingUnits = this.getModel("local").getProperty("/HandlingUnitLists");
			}
			var oData = {
				shipmentid: "",
				inputids: (this.sInputIDs) ? this.sInputIDs : "",
				inputtype: (this.sInputType) ? this.sInputType : "",
				ConsolidationSet: (this.aConsolidation) ? this.aConsolidation : [],
				profile: (this.sProfile) ? this.sProfile : "",
				warehousenum: (this.sWarehouseNumber) ? this.sWarehouseNumber : "",
				shippingstation: (this.sStation) ? this.sStation : "",
				action: sActionName,
				carrierMoreOption: this.getModel("local").getProperty("/ShipmentCarrierOptions"),
				HandlingUnits: aHandlingUnits,
				SerialSet: aMasterList
			};
			return oData;
		},

		_updateShippingStatus: function (bError) {
			var aHandlingUnits = this.getModel("local").getProperty("/HandlingUnitLists");
			var aTotes = this.getModel("local").getProperty("/Contents");
			var bCanShip = false;
			var bCanDeleteShip = false;
			var afind = []
			if (aTotes.length > 0) {
				bCanShip = true;
				bCanDeleteShip = true;
			} else {
				if (aHandlingUnits) {
					if (aHandlingUnits.length === 0) {
						bCanShip = true;
						bCanDeleteShip = true;
						return;
					}
				}
			}
			if (bError) {
				bCanShip = false;
				bCanDeleteShip = false;
			}
			var found = aHandlingUnits.find(function (item) {
				return item.Trackingnumber === "";
			});
			if (found) {
				bCanShip = true;
				bCanDeleteShip = true;
			}
			if (aHandlingUnits.length > 0) {
				aHandlingUnits.forEach(function (item) {
					if (item.Trackingnumber !== "") {
						afind.push(item);
					}
				});
			}
			if (afind.length > 0) {
				this.getModel("local").setProperty("/printEnabled", true);
			} else {
				this.getModel("local").setProperty("/printEnabled", false);
			}
			this.getModel("local").setProperty("/CanShip", bCanShip);
			this.getModel("local").setProperty("/CanDelShip", bCanDeleteShip);
		},

		_getSelectedHandlingUnits: function () {
			var aHandlingUnits = [];
			var aSelectedHus = this.oHUTable.getSelectedItems();
			if (aSelectedHus.length === 0) {
				// select all item
				aHandlingUnits = this.getModel("local").getProperty("/HandlingUnitLists");
			} else {
				for (var i = 0; i < aSelectedHus.length; i++) {
					aHandlingUnits.push(aSelectedHus[i].getBindingContext("local").getObject());
				}
			}
			return aHandlingUnits;
		},

		_getHazardous: function () {
			this.showBusy();
			var oRequestData = this._generateHazardousUsecase();
			var oDeferred = $.Deferred();
			this.getModel().create("/ShipmentQuerySet", oRequestData, {
				success: function (oData) {
					if (oData.Hazmat_Data) {
						this.getModel("local").setProperty("/Bindingcarriername", oData.basic.carrier_data.carriername);
						var aHazmat = [];
						oData.Hazmat_Data.results.forEach(function (item) {
							for (var i = 0; i < item.FrtHazmat.results.length; i++) {
								if (item.FrtHazmat.results[i].exidv !== "") {
									aHazmat.push(item.FrtHazmat.results[i]);
								}
							}
						});
						//handle binding DropDown HU
						this.getModel("local").setProperty("/BindingHU", aHazmat);
						// handle binding hazmat detail
						var aHazmatItems = [];
						for (var j = 0; j < aHazmat.length; j++) {
							var objExidv = aHazmat[j].exidv;
							for (var k = 0; k < aHazmat[j].ItHazmat.results.length; k++) {
								aHazmat[j].ItHazmat.results[k].Exidv = objExidv;
								aHazmatItems.push(aHazmat[j].ItHazmat.results[k]);
							}
						}
						var aDataOld = this.getModel("local").getProperty("/FreightunitHazmats");
						var bcheckIndicator = this.indicator;
						var bcheckIdnumber = this.idnumber;
						if (aDataOld) {
							var findHazmat = aDataOld.find(function (items) {
								return items.Updated !== "";
							});
							if (!this.bcheckHazmatupdate) {
								if (findHazmat) {
									var result = [];
									for (var i = 0; i < aHazmatItems.length; i++) {
										var currentItem = aHazmatItems[i];
										//check selected
										if (bcheckIdnumber === currentItem.Idnumber) {
											if (bcheckIndicator === "") {
												currentItem.Selected = bcheckIndicator;
											}
										}
										var found = false;
										for (var j = 0; j < aDataOld.length; j++) {
											var oldItem = aDataOld[j];
											if (oldItem.Exidv === currentItem.Exidv && oldItem.Idnumber === currentItem.Idnumber) {
												if (oldItem.Updated === "X") {
													result.push(oldItem);
													found = true;
												}
												break;
											}
										}

										if (!found) {
											result.push(currentItem);
										}
									}

									this.getModel("local").setProperty("/FreightunitHazmats", result);
								} else {
									aHazmatItems.forEach(function (item) {
										//check selected
										if (bcheckIdnumber === item.Idnumber) {
											if (bcheckIndicator === "") {
												item.Selected = bcheckIndicator;
											}
										}
									});
									this.getModel("local").setProperty("/FreightunitHazmats", aHazmatItems);
								}
							} else {
								this.getModel("local").setProperty("/FreightunitHazmats", aHazmatItems);
							}
							this.bcheckHazmatupdate = false;
						} else {
							this.getModel("local").setProperty("/FreightunitHazmats", aHazmatItems);
						}

						//handle binding hazmatoption
						var aHazmatOpt = [];
						this.aHazmatOptItems = [];
						for (var m = 0; m < aHazmat.length; m++) {
							for (var n = 0; n < aHazmat[m].ItHazmatOption.results.length; n++) {
								this.aHazmatOptItems.push(aHazmat[m].ItHazmatOption.results[n]);
								for (var o = 0; o < aHazmat[m].ItHazmatOption.results[n].Carropt.results.length; o++) {
									if (aHazmatOpt.length < 1) {
										aHazmatOpt.push(aHazmat[m].ItHazmatOption.results[n].Carropt.results);
									}
								}
							}
						}
						this.getModel("local").setProperty("/BindingHazmatOpt", aHazmatOpt[0]);
					}
					this.getModel("local").setProperty("/BindingHazmatOptCarrcode", aHazmat[0].ItHazmatOption.results[0]);
					this.oHazmatDialog = Utils.getFragment("", "HazmatDialog", this);
					this._getHazmatoptionAndTable();
					this.oHazmatDialog.open();
					this._handleBindingSubPanel(aHazmatItems);
					oDeferred.resolve(oData);
					this.hideBusy();
				}.bind(this),
				error: function (oError) {
					this._handleODataError(oError);
					this.hideBusy();
					oDeferred.reject(oError);
				}.bind(this)
			});
			return oDeferred.promise();
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
			var sKey = oSelectedFreightUnitItem.Outbhu;
			var aResults = [];
			var aHazmatContinues = oSelectedFreightUnitItem.freightunit_hazmat.results || oSelectedFreightUnitItem.freightunit_hazmat;
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
			var aSelectedHUs = this._getSelectedHandlingUnits();
			var aHandlingUnits = [];
			var aHUList = this.getModel("local").getProperty("/HandlingUnitLists");
			for (var i = 0; i < aHUList.length; i++) {
				for (var j = 0; j < aSelectedHUs.length; j++) {
					if (aHUList[i].Outbhu === aSelectedHUs[j].Outbhu) {
						aHUList[i].Sel = 'X';
						aHandlingUnits.push(aHUList[i]);
					}
				}
			}
			var HUSList = this._handleHUSPayload(aHandlingUnits);
			var aHazmat_Data = [{
				SelectedIds: [],
				FrtHazmat: [{
					ItHazmat: [],
					ItHazmatOption: [{
						Carropt: [{
							valueList: []
						}]
					}]
				}]
			}];
			var oData = {
				shipmentid: "",
				inputtype: (this.sInputType) ? this.sInputType : "",
				ConsolidationSet: (this.aConsolidation) ? this.aConsolidation : [],
				profile: (this.sProfile) ? this.sProfile : "",
				shippingstation: (this.sStation) ? this.sStation : "",
				inputids: (this.sInputIDs) ? this.sInputIDs : "",
				carrierMoreOption: [{
					valueList: []
				}],
				warehousenum: (this.sWarehouseNumber) ? this.sWarehouseNumber : "",
				action: "GetHazmatDetails",
				basic: this.getModel("local").getProperty("/basic"),
				HandlingUnits: HUSList,
				Hazmat_Data: aHazmat_Data
			};
			return oData;
		},

		_validateHazmat: function () {
			var oRequestData = this._generateValidateHazmatUsecase();
			this.showBusy();
			this.getModel().create("/ShipmentQuerySet", oRequestData, {
				success: function (oData) {
					if (oData.return && oData.return.results.length > 0) {
						MessageBox.error(oData.return.results[0].Message);
						this.hideBusy();
						return;
					}
					var aHazmat = [];
					oData.Hazmat_Data.results.forEach(function (item) {
						for (var i = 0; i < item.FrtHazmat.results.length; i++) {
							if (item.FrtHazmat.results[i].exidv !== "") {
								aHazmat.push(item.FrtHazmat.results[i]);
							}
						}
					});
					//handle binding DropDown HU
					this.getModel("local").setProperty("/BindingHU", aHazmat);
					// handle binding hazmat detail
					var aHazmatItems = [];
					for (var j = 0; j < aHazmat.length; j++) {
						var objExidv = aHazmat[j].exidv;
						for (var k = 0; k < aHazmat[j].ItHazmat.results.length; k++) {
							aHazmat[j].ItHazmat.results[k].Exidv = objExidv;
							aHazmatItems.push(aHazmat[j].ItHazmat.results[k]);
						}
					}
					this.getModel("local").setProperty("/FreightunitHazmats", aHazmatItems);
					// var oBinding = this.byId(this.getView().createId("hazmatDetailContainer")).getBindingContext("local");
					// var oDataBinding = oBinding.getObject();
					// oDataBinding.Updated = "X";
					// this.getModel("local").setProperty(oBinding.getPath(), oDataBinding);
					// this.oUpdateHazatdata = this.getModel("local").getProperty(oBinding.getPath(), oDataBinding);
					// var sHUstatus = oData.HandlingUnits.results;
					// this.getModel("local").setProperty("/HandlingUnitLists", sHUstatus);
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
			var aHandlingUnits = this.getModel("local").getProperty("/HandlingUnitLists");
			var oHazmat = this.byId(this.getView().createId("hazmatDetailContainer")).getBindingContext("local").getObject();
			var oBindingHazmat = this.getModel("local").getProperty("/UpdateHazmat");
			//It hazmat
			var aFreightunitHazmats = this.getModel("local").getProperty("/FreightunitHazmats");
			//HazmatOption
			var BindingHU = this.getModel("local").getProperty("/BindingHU");
			if (!oHazmat) {
				return null;
			}
			var HUSList = this._handleHUSPayload(aHandlingUnits);
			var aHazmatItems = [];
			var aHazmat_Data = [];
			for (var j = 0; j < BindingHU.length; j++) {
				for (var l = 0; l < aFreightunitHazmats.length; l++) {
					if (aFreightunitHazmats[l].Exidv === BindingHU[j].exidv) {
						aHazmatItems.push(aFreightunitHazmats[l]);
					}
				}
				var findHazmat = aHazmatItems.find(function (items) {
					return items.Idnumber === oBindingHazmat.Idnumber && items.Exidv === oBindingHazmat.Exidv;
				});

				if (findHazmat) {
					aHazmat_Data.push({
						SelectedIds: [{
							Document_Id: oBindingHazmat.DocumentId,
							Document_Item_Id: oBindingHazmat.DocumentItemId,
							DgId: oBindingHazmat.Idnumber,
							Exidv: oBindingHazmat.Exidv
						}],
						FrtHazmat: [{
							ItHazmat: aHazmatItems,
							ItHazmatOption: BindingHU[j].ItHazmatOption.results,
							exidv: BindingHU[j].exidv
						}],
						Update: "X"
					});
				} else {
					aHazmat_Data.push({
						SelectedIds: [],
						FrtHazmat: [{
							ItHazmat: aHazmatItems,
							ItHazmatOption: [],
							exidv: BindingHU[j].exidv
						}]
					});
				}
				aHazmatItems = [];
			}

			var oData = {
				shipmentid: "",
				inputtype: (this.sInputType) ? this.sInputType : "",
				ConsolidationSet: (this.aConsolidation) ? this.aConsolidation : [],
				profile: (this.sProfile) ? this.sProfile : "",
				shippingstation: (this.sStation) ? this.sStation : "",
				warehousenum: (this.sWarehouseNumber) ? this.sWarehouseNumber : "",
				inputids: (this.sInputIDs) ? this.sInputIDs : "",
				action: "UpdateHazmat",
				basic: this.getModel("local").getProperty("/basic"),
				HandlingUnits: HUSList,
				Hazmat_Data: aHazmat_Data,
				return: []
			};
			return oData;
		},
		onUpdateMultiplePress: function () {
			//handle data hazmat option
			this.handleHazmatOptionDataBeforeGenerate();
			var oRequestData = this._generateValidateHazmatMultipleUsecase();
			this.showBusy();
			this.getModel().create("/ShipmentQuerySet", oRequestData, {
				success: function (data) {
					this.hideBusy();
					if (data.return && data.return.results.length > 0) {
						MessageBox.error(data.return.results[0].Message);
						this.hideBusy();
						return;
					}

					if (data.return && data.return.results.length > 0) {
						MessageBox.error(data.return.results[0].Message);
						this.hideBusy();
						return;
					}
					var aHazmat = [];
					data.Hazmat_Data.results.forEach(function (item) {
						for (var i = 0; i < item.FrtHazmat.results.length; i++) {
							if (item.FrtHazmat.results[i].exidv !== "") {
								aHazmat.push(item.FrtHazmat.results[i]);
							}
						}
					});
					//handle binding DropDown HU
					this.getModel("local").setProperty("/BindingHU", aHazmat);
					// handle binding hazmat detail
					var aHazmatItems = [];
					for (var j = 0; j < aHazmat.length; j++) {
						var objExidv = aHazmat[j].exidv;
						for (var k = 0; k < aHazmat[j].ItHazmat.results.length; k++) {
							aHazmat[j].ItHazmat.results[k].Exidv = objExidv;
							aHazmatItems.push(aHazmat[j].ItHazmat.results[k]);
						}
					}
					this.getModel("local").setProperty("/FreightunitHazmats", aHazmatItems);
					// var oBinding = this.byId(this.getView().createId("hazmatDetailContainer")).getBindingContext("local");
					// var oData = oBinding.getObject();
					// oData.Updated = "X";
					// this.getModel("local").setProperty(oBinding.getPath(), oData);
					// this.oUpdateHazatdata = this.getModel("local").getProperty(oBinding.getPath(), oData);
					this.hideBusy();
					this.getModel("local").setProperty("/HazmatData", data.Hazmat_Data.results);
					MessageToast.show(this.oBundle.getText("UpdateAllHazmatSuccess"));
				}.bind(this),
				error: function (oError) {
					this._handleODataError(oError);
					this.hideBusy();
				}.bind(this)
			});
		},

		_generateValidateHazmatMultipleUsecase: function () {
			var aHandlingUnits = this.getModel("local").getProperty("/HandlingUnitLists");
			var oHazmat = this.byId(this.getView().createId("hazmatDetailContainer")).getBindingContext("local").getObject();
			// var oBindingHazmat = this.getModel("local").getProperty("/UpdateHazmat");
			//It hazmat
			var aFreightunitHazmats = this.getModel("local").getProperty("/FreightunitHazmats");
			var BindingHU = this.getModel("local").getProperty("/BindingHU");
			//HazmatOption
			// var aHazmatOption = this.getModel("local").getProperty("/BindingHazmatOpt");
			if (!oHazmat) {
				return null;
			}
			// aHandlingUnits[0].FreightunitHazmat = [oHazmat];
			var HUSList = this._handleHUSPayload(aHandlingUnits);
			var aHazmatItems = [];
			var aHazmat_Data = [];
			for (var j = 0; j < BindingHU.length; j++) {
				for (var l = 0; l < aFreightunitHazmats.length; l++) {
					if (aFreightunitHazmats[l].Exidv === BindingHU[j].exidv) {
						aHazmatItems.push(aFreightunitHazmats[l]);
					}
				}
				var aSelectedIds = [];
				for (var k = 0; k < aHazmatItems.length; k++) {
					aSelectedIds.push({
						Document_Id: aHazmatItems[k].DocumentId,
						Document_Item_Id: aHazmatItems[k].DocumentItemId,
						DgId: aHazmatItems[k].Idnumber,
						Exidv: aHazmatItems[k].Exidv
					});
				}

				aHazmat_Data.push({
					SelectedIds: aSelectedIds,
					FrtHazmat: [{
						ItHazmat: aHazmatItems,
						ItHazmatOption: BindingHU[j].ItHazmatOption.results,
						exidv: BindingHU[j].exidv
					}],
					Update: "X"
				});
				aHazmatItems = [];
				aSelectedIds = [];
			}

			var oData = {
				shipmentid: "",
				inputtype: (this.sInputType) ? this.sInputType : "",
				ConsolidationSet: (this.aConsolidation) ? this.aConsolidation : [],
				profile: (this.sProfile) ? this.sProfile : "",
				shippingstation: (this.sStation) ? this.sStation : "",
				inputids: (this.sInputIDs) ? this.sInputIDs : "",
				warehousenum: (this.sWarehouseNumber) ? this.sWarehouseNumber : "",
				action: "UpdateHazmat",
				basic: this.getModel("local").getProperty("/basic"),
				HandlingUnits: HUSList,
				Hazmat_Data: aHazmat_Data,
				return: []
			};
			return oData;
		},

		_validateAllHazmat: function () {
			var oRequestData = this._generateValidateAllHazmatUsecase();
			this.showBusy();
			this.getModel().create("/ShipmentQuerySet", oRequestData, {
				success: function (OData) {
					var aMsg = this._generateMessages(OData.return.results);
					var aMessage = [];
					aMsg.forEach(function (items) {
						if (items.type === "Success" || items.type === "Warning") {
							aMessage.push(items.title);
						} else {
							MessageBox.error(OData.return.results[0].Message);
						}
					});
					var sHUstatus = OData.HandlingUnits.results;
					for (var i = 0; i < sHUstatus.length; i++) {
						if (sHUstatus[i].Statusdg !== "") {
							this.getModel("local").setProperty("/HandlingUnitLists", sHUstatus);
						}
					}
					var aHazmat = [];
					OData.Hazmat_Data.results.forEach(function (item) {
						for (i = 0; i < item.FrtHazmat.results.length; i++) {
							if (item.FrtHazmat.results[i].exidv !== "") {
								aHazmat.push(item.FrtHazmat.results[i]);
							}
						}
					});
					//handle binding DropDown HU
					this.getModel("local").setProperty("/BindingHU", aHazmat);
					// handle binding hazmat detail
					var aHazmatItems = [];
					for (var j = 0; j < aHazmat.length; j++) {
						var objExidv = aHazmat[j].exidv;
						for (var k = 0; k < aHazmat[j].ItHazmat.results.length; k++) {
							aHazmat[j].ItHazmat.results[k].Exidv = objExidv;
							aHazmatItems.push(aHazmat[j].ItHazmat.results[k]);
						}
					}
					this.getModel("local").setProperty("/FreightunitHazmats", aHazmatItems);
					if (aMessage.length > 0) {
						var myString = "";
						for (var l = 0; l < aMessage.length; l++) {
							myString += aMessage[l] + "\n";
						}
						MessageBox.information(myString);
						this.oHazmatDialog.close();
					}
					this.getModel("local").setProperty("/HazmatData", OData.Hazmat_Data.results);
					this.hideBusy();
					this.oHazmatDialog.close();
				}.bind(this),
				error: function (oError) {
					this._handleODataError(oError);
					this.hideBusy();
				}.bind(this)
			});
		},

		_generateValidateAllHazmatUsecase: function () {
			var aHandlingUnits = this.getModel("local").getProperty("/HandlingUnitLists");
			var aHazmatUpdated = this.getModel("local").getProperty("/FreightunitHazmats");
			var BindingHU = this.getModel("local").getProperty("/BindingHU");
			var HUSList = this._handleHUSPayload(aHandlingUnits);
			var aHazmatItems = [];
			var aHazmat_Data = [];
			for (var j = 0; j < BindingHU.length; j++) {
				for (var l = 0; l < aHazmatUpdated.length; l++) {
					if (aHazmatUpdated[l].Exidv === BindingHU[j].exidv) {
						aHazmatItems.push(aHazmatUpdated[l]);
					}
				}
				var aSelectedIds = [];
				for (var k = 0; k < aHazmatItems.length; k++) {
					aSelectedIds.push({
						Document_Id: aHazmatItems[k].DocumentId,
						Document_Item_Id: aHazmatItems[k].DocumentItemId,
						DgId: aHazmatItems[k].Idnumber,
						Exidv: aHazmatItems[k].Exidv
					});
				}

				aHazmat_Data.push({
					SelectedIds: aSelectedIds,
					FrtHazmat: [{
						ItHazmat: aHazmatItems,
						ItHazmatOption: BindingHU[j].ItHazmatOption.results,
						exidv: BindingHU[j].exidv
					}]
				});
				aHazmatItems = [];
				aSelectedIds = [];
			}

			var oData = {
				shipmentid: "",
				shippingstation: (this.sStation) ? this.sStation : "",
				inputtype: (this.sInputType) ? this.sInputType : "",
				ConsolidationSet: (this.aConsolidation) ? this.aConsolidation : [],
				profile: (this.sProfile) ? this.sProfile : "",
				inputids: (this.sInputIDs) ? this.sInputIDs : "",
				warehousenum: (this.sWarehouseNumber) ? this.sWarehouseNumber : "",
				action: "ValidateAllHazmat",
				basic: this.getModel("local").getProperty("/basic"),
				HandlingUnits: HUSList,
				Hazmat_Data: aHazmat_Data,
				return: []
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
			//update hazmat
			this.getModel("local").setProperty("/UpdateHazmat", oData);

		},

		_numOfShippedItems: function (aItemsControl) {
			var iNumOfShippedItems = 0;
			var oItemData = {};
			for (var i = 0; i < aItemsControl.length; i++) {
				oItemData = aItemsControl[i].getBindingContext("local").getObject();
				if (oItemData.Trackingnumber !== "") {
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
				if (oItemData.Trackingnumber !== "") {
					Array.prototype.push.apply(aShippedItems, oItemData.results);
				}
			}
			return aShippedItems;
		},

		editFreightUnit: function (isEdit, sFreightunitkey, sColumnName) {
			var sUseScale = this.getModel("local").getProperty("/UseScale");
			var aHandlingUnitEdits = this.getModel("local").getProperty("/aHandlingUnitEdits") || [];
			var bResult = true;
			if (sUseScale === "3") {
				// disable dims_unit column
				if (sColumnName === "dims_unit") {
					bResult = false;
				} else {
					bResult = true;
				}
			} else if (sUseScale === "2" && aHandlingUnitEdits.indexOf(sFreightunitkey) >= 0) {
				// disable dims_unit column
				if (sColumnName === "dims_unit") {
					bResult = false;
				} else {
					bResult = true;
				}
			} else if (sUseScale === "1" && aHandlingUnitEdits.indexOf(sFreightunitkey) >= 0) {
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

		// _printPreviewHazmat: function () {
		// 	var oRequestData = this._generatePrintPreviewHazmatUsecase();
		// 	this.showBusy();
		// 	this.getModel().create("/ShipmentQuerySet", oRequestData, {
		// 		success: function (oData) {
		// 			if (oData.HazmatPrintSet) {
		// 				if (oData.HazmatPrintSet.results.length === 0) {
		// 					MessageBox.error(this.oBundle.getText("NoPrintPreview"));
		// 				} else {
		// 					var sPath;
		// 					for (var i = 0; i < oData.HazmatPrintSet.results.length; i++) {
		// 						sPath = this.getModel().sServiceUrl + "/HazmatPrintSet(shipmentid='',Guid='" + oData.HazmatPrintSet.results[i].Guid +
		// 							"')/$value";
		// 						sap.m.URLHelper.redirect(sPath, true);
		// 					}
		// 					MessageToast.show(this.oBundle.getText("PrintSuccess"));
		// 				}
		// 			}
		// 			this.hideBusy();
		// 		}.bind(this),
		// 		error: function (oError) {
		// 			this._handleODataError(oError);
		// 			this.hideBusy();
		// 		}.bind(this)
		// 	});
		// },

		_generatePrintPreviewHazmatUsecase: function () {
			var aHandlingUnits = [{
				carrierMoreOption: [{
					valueList: []
				}]
			}];
			if (this.getModel("local").getProperty("/HandlingUnitLists") && this.getModel("local").getProperty("/HandlingUnitLists").length > 0) {
				aHandlingUnits = this.getModel("local").getProperty("/HandlingUnitLists");
			}
			var oData = {
				shipmentid: "",
				inputids: (this.sInputIDs) ? this.sInputIDs : "",
				inputtype: (this.sInputType) ? this.sInputType : "",
				ConsolidationSet: (this.aConsolidation) ? this.aConsolidation : [],
				profile: (this.sProfile) ? this.sProfile : "",
				warehousenum: (this.sWarehouseNumber) ? this.sWarehouseNumber : "",
				shippingstation: (this.sStation) ? this.sStation : "",
				action: "PrintPreviewHazmat",
				carrierMoreOption: this.getModel("local").getProperty("/ShipmentCarrierOptions"),
				HandlingUnits: aHandlingUnits,
				basic: this.getModel("local").getProperty("/basic"),
				HTS: this.getModel("local").getProperty("/HTS"),
				References: this.getModel("local").getProperty("/References"),
				HazmatPrintSet: []
			};
			return oData;
		},

		// _printHazmat: function () {
		// 	var oRequestData = this._generatePrintHazmatUsecase();
		// 	this.showBusy();
		// 	this.getModel().create("/ShipmentQuerySet", oRequestData, {
		// 		success: function () {
		// 			MessageToast.show(this.oBundle.getText("PrintSuccess"));
		// 			this.hideBusy();
		// 		}.bind(this),
		// 		error: function (oError) {
		// 			this._handleODataError(oError);
		// 			this.hideBusy();
		// 		}.bind(this)
		// 	});
		// },

		_generatePrintHazmatUsecase: function () {
			var aHandlingUnits = [{
				carrierMoreOption: [{
					valueList: []
				}]
			}];
			if (this.getModel("local").getProperty("/HandlingUnitLists") && this.getModel("local").getProperty("/HandlingUnitLists").length > 0) {
				aHandlingUnits = this.getModel("local").getProperty("/HandlingUnitLists");
			}
			var oData = {
				shipmentid: "",
				inputids: (this.sInputIDs) ? this.sInputIDs : "",
				inputtype: (this.sInputType) ? this.sInputType : "",
				ConsolidationSet: (this.aConsolidation) ? this.aConsolidation : [],
				profile: (this.sProfile) ? this.sProfile : "",
				warehousenum: (this.sWarehouseNumber) ? this.sWarehouseNumber : "",
				shippingstation: (this.sStation) ? this.sStation : "",
				action: "PrintHazmat",
				carrierMoreOption: this.getModel("local").getProperty("/ShipmentCarrierOptions"),
				HandlingUnits: aHandlingUnits,
				basic: this.getModel("local").getProperty("/basic"),
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
			var aHandlingUnits = [{
				carrierMoreOption: [{
					valueList: []
				}]
			}];
			if (this.getModel("local").getProperty("/HandlingUnitLists") && this.getModel("local").getProperty("/HandlingUnitLists").length > 0) {
				aHandlingUnits = this.getModel("local").getProperty("/HandlingUnitLists");
			}
			var oData = {
				shipmentid: "",
				inputids: (this.sInputIDs) ? this.sInputIDs : "",
				inputtype: (this.sInputType) ? this.sInputType : "",
				ConsolidationSet: (this.aConsolidation) ? this.aConsolidation : [],
				profile: (this.sProfile) ? this.sProfile : "",
				warehousenum: (this.sWarehouseNumber) ? this.sWarehouseNumber : "",
				shippingstation: (this.sStation) ? this.sStation : "",
				action: sAction,
				carrierMoreOption: this.getModel("local").getProperty("/ShipmentCarrierOptions"),
				basic: this.getModel("local").getProperty("/basic"),
				HandlingUnits: aHandlingUnits,
				HTS: this.getModel("local").getProperty("/HTS"),
				References: this.getModel("local").getProperty("/References"),
				ShipmentTrackingsSet: []
			};
			return oData;
		},

		_updateHazmatChange: function (oBinding) {
			var oData = oBinding.getObject();
			var aData = this.getModel("local").getProperty("/FreightunitHazmats")
			var that = this;
			var aHazardousMaterial = [];
			aData.forEach(function (item) {
				if (item.Idnumber === oData.Idnumber) {
					item.Dgnew = that.byId("cbDgnew").getValue();
					item.Dgnewuom = that.byId("cbDgnewuom").getValue();
					item.Packqty = that.byId("cbPackqty").getValue();
					item.Propershipnam = that.byId("cbPropershipnam").getValue();
					item.Propershipna2 = that.byId("cbPropershipna2").getValue();
					item.Labeltext = that.byId("cbLabeltext").getValue();
					item.Packweight = that.byId("cbPackweight").getValue();
					item.Packuom = that.byId("cbPackuom").getValue();
					item.Packnetweight = that.byId("cbPacknetweight").getValue();
					item.Hazaddhandling = that.byId("cbHazaddhandling").getValue();
					//Combobox
					item.Auth = that.byId("cbAuth").getSelectedKey();
					item.Dgshiptype = that.byId("cbDgshiptype").getSelectedKey();
					item.Innerpackagetype = that.byId("cbInnerPackType").getSelectedKey();
					item.Airservices = that.byId("cbAirservices").getSelectedKey();
					item.Packinggroup = that.byId("cbPackinggroup").getSelectedKey();
					item.Packagetype = that.byId("cbPackType").getSelectedKey();
				}
				aHazardousMaterial.push(item);
			})
			this.getModel("local").setProperty("/FreightunitHazmats", aHazardousMaterial);
			// var oData = oBinding.getObject();
			// var sPath = oBinding.getPath();
			// this.getModel("local").setProperty(sPath, oData);
		},

		_checkShipmentComplete: function () {
			this.bCheckShipmentComplete = true;
			var bCompleteShipment = true;
			var aHandlingUnits = this.getModel("local").getProperty("/HandlingUnitLists");
			if (aHandlingUnits) {
				if (aHandlingUnits.length === 0) {
					return;
				}
				for (var i = 0; i < aHandlingUnits.length; i++) {
					var item = aHandlingUnits[i];
					if (item.Trackingnumber === "") {
						bCompleteShipment = false;
						break;
					}
				}
				if (bCompleteShipment && !this.bError) {
					MessageBox.information(this.oBundle.getText("shipmentCompleteMsg"));
				}

			}
		},
		_updateBillingInformation: function () {
			var oRequestData = this._generateSetBillingOptionUsecase();
			this.showBusy();
			this.getModel().create("/ShipmentQuerySet", oRequestData, {
				success: function (oData) {
					if (oData.HandlingUnits) {
						this.getModel("local").setProperty("/HandlingUnitLists", oData.HandlingUnits.results);
					}
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
			var sActionName = "ChangeBillingOption";
			var oData = {
				shipmentid: "",
				inputids: (this.sInputIDs) ? this.sInputIDs : "",
				inputtype: (this.sInputType) ? this.sInputType : "",
				ConsolidationSet: (this.aConsolidation) ? this.aConsolidation : [],
				profile: (this.sProfile) ? this.sProfile : "",
				warehousenum: (this.sWarehouseNumber) ? this.sWarehouseNumber : "",
				shippingstation: (this.sStation) ? this.sStation : "",
				action: sActionName,
				carrierMoreOption: this.getModel("local").getProperty("/ShipmentCarrierOptions"),
				basic: this.getModel("local").getProperty("/basic"),
				HandlingUnits: this._handleHUSPayload(this.getModel("local").getProperty("/HandlingUnitLists")),
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
					if (oData.HandlingUnits) {
						this.getModel("local").setProperty("/HandlingUnitLists", oData.HandlingUnits.results);
					}
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
			var aHandlingUnits = [{
				carrierMoreOption: [{
					valueList: []
				}]
			}];
			if (this.getModel("local").getProperty("/HandlingUnitLists") && this.getModel("local").getProperty("/HandlingUnitLists").length > 0) {
				aHandlingUnits = this.getModel("local").getProperty("/HandlingUnitLists");
			}
			if (bHeader) {
				oData = {
					shipmentid: "",
					inputids: (this.sInputIDs) ? this.sInputIDs : "",
					inputtype: (this.sInputType) ? this.sInputType : "",
					ConsolidationSet: (this.aConsolidation) ? this.aConsolidation : [],
					profile: (this.sProfile) ? this.sProfile : "",
					warehousenum: (this.sWarehouseNumber) ? this.sWarehouseNumber : "",
					shippingstation: (this.sStation) ? this.sStation : "",
					action: sActionName,
					carrierMoreOption: this.getModel("local").getProperty("/ShipmentCarrierOptions"),
					HandlingUnits: aHandlingUnits,
					basic: this.getModel("local").getProperty("/basic"),
					FreightunitHeaders: this.getModel("local").getProperty("/FreightunitHeaders")
				};
			} else {
				oData = {
					shipmentid: "",
					inputids: (this.sInputIDs) ? this.sInputIDs : "",
					inputtype: (this.sInputType) ? this.sInputType : "",
					ConsolidationSet: (this.aConsolidation) ? this.aConsolidation : [],
					profile: (this.sProfile) ? this.sProfile : "",
					warehousenum: (this.sWarehouseNumber) ? this.sWarehouseNumber : "",
					shippingstation: (this.sStation) ? this.sStation : "",
					action: sActionName,
					carrierMoreOption: this.getModel("local").getProperty("/ShipmentCarrierOptions"),
					HandlingUnits: aHandlingUnits,
					basic: this.getModel("local").getProperty("/basic")
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
					if (oData.HandlingUnits) {
						this.getModel("local").setProperty("/HandlingUnitLists", oData.HandlingUnits.results);
					}
					// Update HandlingUnits json node
					if (oData.HandlingUnits) {
						// for (var i = 0; i < oData.HandlingUnits.results.length; i++) {
						// 	if (!oData.HandlingUnits.results[i].FreightunitItems) {
						// 		oData.HandlingUnits.results[i].FreightunitItems = [];
						// 	}
						// 	if (!oData.HandlingUnits.results[i].FreightunitItems.results) {
						// 		oData.HandlingUnits.results[i].FreightunitItems = [];
						// 	}
						// 	if (!oData.HandlingUnits.results[i].FreightunitHazmat) {
						// 		oData.HandlingUnits.results[i].FreightunitHazmat = [];
						// 	}
						// 	if (!oData.HandlingUnits.results[i].FreightunitHazmat.results) {
						// 		oData.HandlingUnits.results[i].FreightunitHazmat = [];
						// 	}
						// }
						this.getModel("local").setProperty("/Freightunits", oData.HandlingUnits.results);
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
			var aHandlingUnits = [{
				carrierMoreOption: [{
					valueList: []
				}]
			}];
			if (this.getModel("local").getProperty("/HandlingUnitLists") && this.getModel("local").getProperty("/HandlingUnitLists").length > 0) {
				aHandlingUnits = this.getModel("local").getProperty("/HandlingUnitLists");
			}
			var oData = {
				shipmentid: sLeftTableFilterType, // Use for BuildITHU usecase only
				inputids: (this.sInputIDs) ? this.sInputIDs : "",
				inputtype: (this.sInputType) ? this.sInputType : "",
				ConsolidationSet: (this.aConsolidation) ? this.aConsolidation : [],
				profile: (this.sProfile) ? this.sProfile : "",
				warehousenum: (this.sWarehouseNumber) ? this.sWarehouseNumber : "",
				shippingstation: (this.sStation) ? this.sStation : "",
				action: sActionName,
				carrierMoreOption: this.getModel("local").getProperty("/ShipmentCarrierOptions"),
				HandlingUnits: aHandlingUnits,
				basic: this.getModel("local").getProperty("/basic"),
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
					if (oData.HandlingUnits) {
						this.getModel("local").setProperty("/HandlingUnitLists", oData.HandlingUnits.results);
					}
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
			var aHandlingUnits = [];
			var aFreightunitHeaders = [];
			var sTargetHU = this.oHURightTable.getSelectedItem().getBindingContext("local").getObject().Outbhu;
			for (var i = 0; i < aSelectedItems.length; i++) {
				aHandlingUnits.push(aSelectedItems[i].getBindingContext("local").getObject());
			}
			aFreightunitHeaders.push(oSelectedRightItem.getBindingContext("local").getObject());
			var oData = {
				shipmentid: "",
				inputids: (this.sInputIDs) ? this.sInputIDs : "",
				inputtype: (this.sInputType) ? this.sInputType : "",
				ConsolidationSet: (this.aConsolidation) ? this.aConsolidation : [],
				profile: (this.sProfile) ? this.sProfile : "",
				warehousenum: (this.sWarehouseNumber) ? this.sWarehouseNumber : "",
				shippingstation: (this.sStation) ? this.sStation : "",
				action: "PackHUToHU",
				carrierMoreOption: this.getModel("local").getProperty("/ShipmentCarrierOptions"),
				targethu: sTargetHU,
				basic: this.getModel("local").getProperty("/basic"),
				HTS: this.getModel("local").getProperty("/HTS"),
				References: this.getModel("local").getProperty("/References"),
				HandlingUnits: aHandlingUnits,
				FreightunitHeaders: aFreightunitHeaders
			};
			return oData;
		},

		_unpackHUFromHU: function () {
			var oRequestData = this._generateUnpackHUFromHUUsecase();
			this.showBusy();
			this.getModel().create("/ShipmentQuerySet", oRequestData, {
				success: function () {
					if (oData.HandlingUnits) {
						this.getModel("local").setProperty("/HandlingUnitLists", oData.HandlingUnits.results);
					}
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
			var aHandlingUnits = [{
				carrierMoreOption: [{
					valueList: []
				}]
			}];
			if (this.getModel("local").getProperty("/HandlingUnitLists") && this.getModel("local").getProperty("/HandlingUnitLists").length > 0) {
				aHandlingUnits = this.getModel("local").getProperty("/HandlingUnitLists");
			}
			var oData = {
				shipmentid: "",
				inputids: (this.sInputIDs) ? this.sInputIDs : "",
				inputtype: (this.sInputType) ? this.sInputType : "",
				ConsolidationSet: (this.aConsolidation) ? this.aConsolidation : [],
				profile: (this.sProfile) ? this.sProfile : "",
				warehousenum: (this.sWarehouseNumber) ? this.sWarehouseNumber : "",
				shippingstation: (this.sStation) ? this.sStation : "",
				action: "UnpackHUFromHU",
				carrierMoreOption: this.getModel("local").getProperty("/ShipmentCarrierOptions"),
				HandlingUnits: aHandlingUnits,
				basic: this.getModel("local").getProperty("/basic"),
				FreightunitHeaders: aFreightunitHeaders
			};
			return oData;
		},

		_showPackingOverview: function (sHU, sObject, sTrackingNumber) {
			this.showBusy();
			var oParam = {
				object: this.sObject,
				objectkey: this.sObjectKey
			};
			if (sObject === "06") {
				oParam.object = sObject;
				oParam.objectkey = sHU;
			}
			//
			var aHuPackParent = this.getModel("local").getProperty("/HUPackDetails");
			/**
			 * (-) 	don't use display condition for list hu. 
			 * Modified by: Michael Ha
			 * Modified at: 06/09/2022
			 */
			var arrHuPack = [];
			aHuPackParent.filter(function (item) {
				if (parseInt(item.handlingUnit, 10) === sHU) {
					if (item.parentHandlingUnit.trim() === '') {
						arrHuPack.push(item);
					}
				}
			});
			var aHandlingUnit = aHuPackParent.filter(function (item) {
				return parseInt(item.parentHandlingUnit, 10) === sHU;
			});
			var aParentHU = aHuPackParent.filter(function (item) {
				return aHandlingUnit.some(function (itemChild) {
					return itemChild.handlingUnit.trim() === item.parentHandlingUnit.trim();
				});
			});
			// var ahandling_unit_and_handling = [...aHandlingUnit, ...aParentHU]
			aHandlingUnit.forEach(function (item) {
				arrHuPack.push(item);
				var findChild = aParentHU.find(function (itemChild) {
					return itemChild.parentHandlingUnit.trim() === item.handlingUnit.trim();
				});
				if (findChild) {
					arrHuPack.push(findChild);
				}
			});
			var aHuPackDialog = this.getModel("local").getProperty("/HuPackDialog");
			if (aHuPackDialog) {
				var aHuPack = arrHuPack.map(function (newItem) {
					var found = aHuPackDialog.find(function (oldItem) {
						return oldItem.handlingUnit.trim() === newItem.handlingUnit.trim() && oldItem.parentHandlingUnit.trim() === newItem.parentHandlingUnit
							.trim() &&
							oldItem.guidStock.trim() === newItem.guidStock.trim();
					});
					if (found) {
						return found;
					}
					return newItem;
				});
				this.getModel("local").setProperty("/HuPackDialog", aHuPack);
				// }
			} else {
				aHuPackDialog = this.getModel("local").setProperty("/HuPackDialog", arrHuPack);
			}

			var aHu = this.getModel("local").getProperty("/HuPackDialog");
			// }
			var aTempOutput = [];
			var aOutput = [];
			if (sObject === "06") {
				//for FU item click
				aOutput = this.treeify(aHu, "handlingUnit", "parentHandlingUnit");
			} else {
				//for advance mode
				if (sHU) {
					for (var i = 0; i < aHu.length; i++) {
						if (parseInt(aHu[i].handlingUnit, 10) === parseInt(sHU, 10)) {
							aTempOutput.push(aHu[i]);
						}
					}
					aOutput = this.treeify(aTempOutput, "handlingUnit", "parentHandlingUnit");
				} else {
					aOutput = this.treeify(aHu, "handlingUnit", "parentHandlingUnit");
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
			if (!this.oPackingOverviewDialog) {
				this.oPackingOverviewDialog = Utils.getFragment("", "packing.PackingOverviewDialog", this);
			}
			if (this.byId("idPackOverViewTab")) {
				this.byId("idPackOverViewTab").clearSelection();
			}
			if (sTrackingNumber) {
				this.byId("idNMFCCode").setEnabled(false);
				this.byId("idFreightClass").setEnabled(false);
				this.byId("btnUnpackItem").setEnabled(false);
			} else {
				this.byId("idNMFCCode").setEnabled(true);
				this.byId("idFreightClass").setEnabled(true);
				this.byId("btnUnpackItem").setEnabled(true);
			}
			this.oPackingOverviewDialog.open();
			this.hideBusy();
		},

		// This method is used to check which scenario the packing is in. Value return:
		//   '01': Pack by Material on Main screen
		//	 '02': Pack by Material on Advance Dialog
		//   '03': Pack by HU on Advance Dialog

		_generatePackingOverviewUsecase: function (sHU) {
			var aHandlingUnits = [{
				carrierMoreOption: [{
					valueList: []
				}]
			}];
			if (this.getModel("local").getProperty("/HandlingUnitLists") && this.getModel("local").getProperty("/HandlingUnitLists").length > 0) {
				aHandlingUnits = this.getModel("local").getProperty("/HandlingUnitLists");
			}
			var oData = {
				shipmentid: "",
				inputids: (this.sInputIDs) ? this.sInputIDs : "",
				inputtype: (this.sInputType) ? this.sInputType : "",
				ConsolidationSet: (this.aConsolidation) ? this.aConsolidation : [],
				profile: (this.sProfile) ? this.sProfile : "",
				warehousenum: (this.sWarehouseNumber) ? this.sWarehouseNumber : "",
				shippingstation: (this.sStation) ? this.sStation : "",
				action: "PackingOverview",
				carrierMoreOption: this.getModel("local").getProperty("/ShipmentCarrierOptions"),
				HandlingUnits: aHandlingUnits,
				basic: this.getModel("local").getProperty("/basic"),
				huident: JSON.stringify(sHU),
				return: [],
				HandlingUnitPackDetails: []
			};
			return oData;
		},
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
			// Get the selected HandlingUnitLists depending on the Packing scenario
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
						var aHUs = this.getModel("local").getProperty("/HandlingUnits");
						for (var i = 0; i < aSelectedHUs.length; i++) {
							var oObject = aSelectedHUs[i].getBindingContext("local").getObject();
							for (var j = 0; j < aHUs.length; j++) {
								if (aHUs[j].Outbhu === oObject.Outbhu) {
									aHUs[j].Weight = parseFloat(oData.GetExternalScale.Weight).toFixed(2);
									this.iOriginalExtScaleWeight = aHUs[j].Weight;
									aHUs[j].WeightUnit = oData.GetExternalScale.WeightUnit;
									this.sOriginalExtScaleWeightUnit = oData.GetExternalScale.WeightUnit;
								}
							}
						}
						this.getModel("local").setProperty("/Freightunits", aHUs);
						this.getModel("local").setProperty("/aHandlingUnitEdits", []);
						this.enableEditHandlingUnitsforExternalScale(false);
					}
					this.hideBusy();
				}.bind(this),
				error: function (oError) {
					this.getModel("local").setProperty("/aHandlingUnitEdits", []);
					this.enableEditHandlingUnitsforExternalScale(false);
					this._handleODataError(oError);
					this.hideBusy();
				}.bind(this)
			});
		},

		_getPackageCarrierMoreOptions: function (oMoreOptionData, sFUItemPath) {
			//set global
			this.currentFUPath = sFUItemPath;
			var oFreightUnitItemRow = this.getModel("local").getProperty(sFUItemPath);
			this.oMoreOptionDialog = Utils.getFragment(null, "packing.MoreOptionsDialog", this);
			this.oMoreOptionDialog.destroyContent();
			if (this.sCarrier && oFreightUnitItemRow.Outbhu) {
				var HUNo = formatter.removeLeadingZero(oFreightUnitItemRow.Outbhu);
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
		// carier more option
		handleCarrierMoreOptionDataBeforeGenerate: function () {
			if (this.oShipmentCarrierOptionTab) {
				this.getFinalShipmentCarrierOptionData(this.oShipmentCarrierOptionTab);
			}
			//remove prefix before submit
			// DynamicView.removePrefixPackage(this);
			DynamicView.removePrefixShipment(this);
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
				MessageBox.warning("Please select an item before detete!");
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
					if (oData.HandlingUnits) {
						this.getModel("local").setProperty("/HandlingUnitLists", oData.HandlingUnits.results);
					}
					MessageToast.show("Save Harmonized Tariff Schedule Successfully!");
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
			var sRequestQuery = this.getModel().sServiceUrl + "/CommodityCodeSet?$filter=inputtype eq '" + this.sInputType +
				"' and inputids eq '" + this.sInputIDs + "' and profile eq '" + this.sProfile + "' and shippingstation eq '" + this.sStation +
				"' and lgnum eq '" + this.sWarehouseNumber + "'";
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
				MessageBox.show("Error!");
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
		onHandleItemsPackingMoreOption: function (oEvent) {
			var itemPath = oEvent.getSource().getBindingContextPath();
			if (itemPath) {
				var oFreightUnitItemRow = this.getModel("local").getProperty(itemPath);
				var aFreightunits = this.getModel("local").getProperty("/HandlingUnitLists");
				for (var i = 0; i < aFreightunits.length; i++) {
					if (parseInt(aFreightunits[i].Outbhu, 10) === parseInt(oFreightUnitItemRow.Outbhu, 10)) {
						oFreightUnitItemRow.carrierMoreOption = aFreightunits[i].carrierMoreOption;
					}
				}
				var oCarrierMoreOptionData = oFreightUnitItemRow.carrierMoreOption;
				if (oCarrierMoreOptionData && oCarrierMoreOptionData.results && oCarrierMoreOptionData.results.length > 0) {
					this._getPackageCarrierMoreOptions(oCarrierMoreOptionData, itemPath);
				} else {
					MessageBox.information("No carrier more option");
				}
			}
		},

		onUnpackItemPackingOverviewDialog: function () {
			var aSelectedItem = [];
			var aIndicies = this.byId("idPackOverViewTab").getSelectedIndices();
			var aRows = this.byId("idPackOverViewTab").getRows();
			for (var i = 0; i < aIndicies.length; i++) {
				if (aRows[aIndicies[i]].getBindingContext("local").getObject().handlingUnit !== this.aHUPackOverView[0].Outbhu) {
					aSelectedItem.push(aRows[aIndicies[i]]);
				}
			}
			if (aSelectedItem.length === 0) {
				MessageBox.error(this.oBundle.getText("missingHUItemToUnpack"));
				return;
			}
			this._unpack(this.aHUPackOverView, aSelectedItem);
		},

		_setCookie: function (sName, sValue) {
			document.cookie = sName + "=" + sValue + ";path=/";
		},

		onResetBizrule: function () {
			this.getModel("local").setProperty("/basic/carrier_data/service", "");
			var oRequestData = this._resetBizruleUsecase();
			this.showBusy();
			this.getModel().create("/ShipmentQuerySet", oRequestData, {
				success: function (oData) {
					this.hideBusy();
					if (oData.ServiceList.results) {
						this.getModel("local").setProperty("/ServiceList", oData.ServiceList.results);
					}
					if (oData.basic.payment) {
						var oPayment = oData.basic.payment;
						this.getModel("local").setProperty("/basic/payment", oPayment);
					}
					this.getModel("local").setProperty("/basic/carrier_data/carrier", oData.carrier);
					var sCarrier = this.getModel("local").getProperty("/basic/carrier_data/carrier");
					this.sCarrier = sCarrier;
					if (oData.service) {
						this.getModel("local").setProperty("/basic/carrier_data/service", oData.service);
					}
					if (oData.return && oData.return.results.length > 0) {
						var aMsg = this._generateMessages(oData.return.results);
						this._addMessage(aMsg);
					}
					if (oData.HandlingUnits) {
						this.getModel("local").setProperty("/HandlingUnitLists", oData.HandlingUnits.results);
					}
					// used to reupdate service id when selecting rate entry from the rate dialog
					if (this.sService !== "") {
						this.getModel("local").setProperty("/basic/carrier_data/service", this.sService);
						this.sService = "";
					}
					if (oData.carrierMoreOption && oData.carrierMoreOption.results) {
						this.getModel("local").setProperty("/ShipmentCarrierOptions", oData.carrierMoreOption.results);
					}
					this.getModel("local").setProperty("/basic/carrier_data/mps/mpstype", oData.basic.carrier_data.mps.mpstype);
					MessageToast.show(this.oBundle.getText("ResetBizruleSuccess"));
					var oDeferredService = this._changeService(this.getModel("local").getProperty("/basic/carrier_data/service"));
					$.when(oDeferredService).done(function () {
						this.hideBusy();
						// Michael old logic backup
						// this._updateTermOfSale(sCarrier);
						this._displayTabs();
						this._updateShippingAndCarrMoreOpt();
						// Filter all the available dropdowns
						this._filterAllDropdowns();
						// display message strip header.
						this._displayMessageStripHeader();
					}.bind(this));
				}.bind(this),
				error: function (oError) {
					this._handleODataError(oError);
					this.hideBusy();
				}.bind(this)
			});
		},

		_resetBizruleUsecase: function () {
			var HUSList = this._handleHUSPayload(this.getModel("local").getProperty("/HandlingUnitLists"));
			var oBasic = this.getModel("local").getProperty("/basic");
			var oPayment = {
				"__metadata": oBasic["__metadata"],
				"payment": oBasic["payment"],
				"carrier_data": oBasic["carrier_data"]
			};
			var aHandlingUnits = [{
				carrierMoreOption: [{
					valueList: []
				}]
			}];
			if (this.getModel("local").getProperty("/HandlingUnitLists") && this.getModel("local").getProperty("/HandlingUnitLists").length > 0) {
				aHandlingUnits = this.getModel("local").getProperty("/HandlingUnitLists");
			}
			var oData = {
				shipmentid: "",
				inputtype: (this.sInputType) ? this.sInputType : "",
				ConsolidationSet: (this.aConsolidation) ? this.aConsolidation : [],
				profile: (this.sProfile) ? this.sProfile : "",
				shippingstation: (this.sStation) ? this.sStation : "",
				// carrierMoreOption: this.getModel("local").getProperty("/ShipmentCarrierOptions"),
				// HTS: this.getModel("local").getProperty("/HTS"),
				// References: this.getModel("local").getProperty("/References"),
				// ValAddressSet: [],
				//avalreturn: {}
				//HandlingUnitLists: HUSList,
				inputids: (this.sInputIDs) ? this.sInputIDs : "",
				warehousenum: (this.sWarehouseNumber) ? this.sWarehouseNumber : "",
				action: 'ResetBizrule',
				HandlingUnits: aHandlingUnits,
				basic: oPayment,
				CarrierList: [],
				ServiceList: [],
				return: [],
			};
			return oData;
		},

		onIdentification: function (oEvent) {
			var sCheckIdentifications = oEvent.getSource().getTooltip().trim();
			var aIdentification = this.getModel("local").getProperty("/Identifications");
			var aDataBinding = [];
			if (sCheckIdentifications === "Ship From Identifications") {
				aIdentification.forEach(function (item) {
					if (item.PartyRole === "SHIPFROM") {
						aDataBinding.push(item);
					}
				});
			} else if (sCheckIdentifications === 'Sold To Identifications') {
				aIdentification.forEach(function (item) {
					if (item.PartyRole === "SOLDTO") {
						aDataBinding.push(item);
					}
				});
			} else if (sCheckIdentifications === 'Ship To Identifications') {
				aIdentification.forEach(function (item) {
					if (item.PartyRole === "SHIPTO") {
						aDataBinding.push(item);
					}
				});
			} else {
				aIdentification.forEach(function (item) {
					if (item.PartyRole === "IMPORTER") {
						aDataBinding.push(item);
					}
				});
			}
			this.getModel("local").setProperty("/IdentificationAll", aDataBinding);
			this._oIdeDialog = Utils.getFragment("", "Identification", this);
			this._oIdeDialog.open();
		},

		onCloseIdentifications: function () {
			this._oIdeDialog.close();
		},

		onCheckAutoCheck: function (oEvent) {
			var onTick = oEvent.getSource().getSelected();
			if (onTick) {
				this._processAutoCheck();
			}
		},

		_generateUsecaseautoship: function (sAction) {
			var HUSList = this._handleHUSPayload(this.getModel("local").getProperty("/HandlingUnitLists"));
			var oData = {
				shipmentid: "",
				autoship: "X",
				inputids: (this.sInputIDs) ? this.sInputIDs : "",
				inputtype: (this.sInputType) ? this.sInputType : "",
				ConsolidationSet: (this.aConsolidation) ? this.aConsolidation : [],
				profile: (this.sProfile) ? this.sProfile : "",
				warehousenum: (this.sWarehouseNumber) ? this.sWarehouseNumber : "",
				shippingstation: (this.sStation) ? this.sStation : "",
				action: sAction,
				basic: this.getModel("local").getProperty("/basic"),
				return: [],
				ShipmentReturnSet: [],
				HandlingUnits: HUSList,
				HandlingUnitItemLists: [{
					HandlingUnitItems: []
				}],
				HandlingUnitPackDetails: [],
				ShipmentLabelSet: []
			};
			return oData;
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

		_generateShipmentInterNationOptions: function (aShipmentInternationOption, oContainer) {
			this.oShipmentInternationalOptions = oContainer;
			//resset shipment
			if (this.oShipmentInternationalOptions.getBlocks()[0] instanceof sap.m.FlexBox) {
				if (this.oShipmentInternationalOptions.getBlocks()[0].getItems()[0] instanceof sap.m.FlexBox) {
					this.oShipmentInternationalOptions.getBlocks()[0].getItems()[0].removeAllContent();
				} else {
					this.oShipmentInternationalOptions.getBlocks()[0].getItems()[1].removeAllItems()
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

		_convertStringtoJson: function (aShipmentOption) {
			aShipmentOption.forEach(function (obj) {
				if (typeof obj.field_value2 === "string" && obj.field_value2 !== "") {
					obj.field_value2 = JSON.parse(obj.field_value2);
					obj.search_help = JSON.parse(obj.search_help);
				}
			});
			return aShipmentOption;
		},

		onAddProductDetail: function () {
			this.oAddProductDetailDialog = Utils.getFragment("", "packing.AddProductDetail", this);
			this.oAddProductDetailDialog.open();
		},
		onProductDetailsClose: function () {
			this.oAddProductDetailDialog.close();
		},
		_convertStringtoJsonHazmat: function (aHazmatOption) {
			aHazmatOption.forEach(function (obj) {
				if (typeof obj.field_value2 === "string" && obj.field_value2 !== "") {
					obj.field_value2 = JSON.parse(obj.field_value2);
				}
			});
			return aHazmatOption;
		},
		_getHazmatoptionAndTable: function () {
				var aHazmatOption = this.getModel("local").getProperty("/BindingHazmatOpt");
				if (aHazmatOption && aHazmatOption.length > 0) {
					this.oHazmatOptions = this.byId("idRenderFormHazmat");
					//resset shipment
					this.oHazmatOptions.removeAllContent()
					var aConverJsonHazmatOption = this._convertStringtoJsonHazmat(aHazmatOption);
					DynamicView.renderHazmatOptionForm(aConverJsonHazmatOption, this, false);
				}
			}
			//end
	});
});