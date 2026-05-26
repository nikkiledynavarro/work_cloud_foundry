/*global location */
sap.ui.define([
	"com/erpis/shiperp/salesorder/hr7/controller/BaseController",
	"sap/ui/model/json/JSONModel",
	"com/erpis/shiperp/salesorder/hr7/model/formatter",
	"sap/ui/Device",
	"sap/ui/model/Filter",
	"com/erpis/shiperp/salesorder/hr7/common/Utils",
	"sap/ui/layout/form/SimpleForm",
	"sap/m/MessageBox",
	"sap/m/MessageToast"
], function (BaseController, JSONModel, formatter, Device, Filter, Utils, SimpleForm, MessageBox, MessageToast) {
	"use strict";
	return BaseController.extend("com.erpis.shiperp.salesorder.hr7.controller.Detail", {

		formatter: formatter,
		sSalesNo: "", // key for navigate,
		sCurrentCarrier: "",
		sOriginal3Acc: "",
		sOriginal3Zip: "",
		sOriginal3Cnt: "",
		bOriginalPrepaid: false,
		oBundle: null, // i18n bundle class

		/* =========================================================== */
		/* lifecycle methods                                           */
		/* =========================================================== */
		onInit: function () {
			// Set the controller property to be used globally in the controller
			this.oBundle = this.getResourceBundle();
			this.getRouter().getRoute("objectDetail").attachPatternMatched(this._onObjectMatched, this);

			// Initialize Message Model
			var oJSONModel = new JSONModel({
				aMessages: [],
				messagesLength: 0
			});
			this.setModel(oJSONModel, "messageModel");

			sap.ui.getCore().getEventBus().subscribe("RATE_QUOTE_SELECTION", function () {
				this.getView().getElementBinding("global").refresh();
				this.byId("idServiceCombo").getBinding("items").filter(new Filter("Scac", "EQ", this.byId("idCarrierCombo").getSelectedKey()));
			}.bind(this));
		},

		/**
		 * Binds the view to the object path and expands the aggregated line items.
		 * @function
		 * @param {sap.ui.base.Event} oEvent pattern match event in route 'object'
		 * @private
		 */
		_onObjectMatched: function (oEvent) {
			// Binding
			var sPath = "global>" + this.getModel("global").getProperty("/selectedShipsetPath");
			// Assign controller properties
			this.sSalesNo = oEvent.getParameter("arguments").SalesNo;
			// Reset the More Option Dialog
			if (this.oMoreOptionDialog) {
				this.oMoreOptionDialog.destroyContent();
				this.oMoreOptionDialog = null;
			}
			this.getView().bindElement({
				path: sPath,
				events: {
					change: this._onBindingChange.bind(this)
				}
			});
		},

		_onBindingChange: function (oEvent) {
			var oView = this.getView(),
				oElementBinding = oView.getElementBinding("global");

			// No data for the binding
			if (!oElementBinding.getBoundContext()) {
				return;
			}

			this.sCurrentCarrier = this.byId("idCarrierCombo").getSelectedKey();
			this.bOriginalPrepaid = this.oView.getBindingContext("global").getObject().Ppaidadd;

			this.getModel("appView").setProperty("/layout", "ThreeColumnsMidExpanded");
			this.byId("idServiceCombo").getBinding("items").filter(new Filter("Scac", "EQ", this.sCurrentCarrier));
		},

		/* =========================================================== */
		/* event handlers                                              */
		/* =========================================================== */
		onCarrierSelectionChange: function (oEvent) {
			if (this.oMoreOptionDialog) {
				var oControl = oEvent.getSource();
				MessageBox.warning(
					"Manually entered data on more options dialog will be reset once you change the carrier. Do you want to continue?", {
						actions: [sap.m.MessageBox.Action.OK, sap.m.MessageBox.Action.CANCEL],
						onClose: function (sAction) {
							if (sAction === "OK") {
								var sCarrier = oControl.getSelectedItem().getKey();
								this.sCurrentCarrier = sCarrier;
								this._changeCarrier(sCarrier);

								// Reset the More Option Dialog
								this.oMoreOptionDialog = null;
							} else {
								oControl.setSelectedKey(this.sCurrentCarrier);
							}
						}.bind(this)
					}
				);
			} else {
				var sCarrier = oEvent.getParameter("selectedItem").getKey();
				this.sCurrentCarrier = sCarrier;
				this._changeCarrier(sCarrier);

				// Reset the More Option Dialog
				this.oMoreOptionDialog = null;
			}
		},

		onChangeService: function (oEvent) {
			this._getServiceDetermination();
		},

		onBillOptDeterminationChange: function (oEvent) {
			this._getBillOptDetermination();
		},

		onInsuranceTypeChange: function (oEvent) {
			this._getInsuranceTypeDetermination();
		},

		onInsuranceValueChange: function (oEvent) {
			this._getInsuranceValueDetermination();
		},

		onSaveShipset: function (oEvent) {
			this._saveShipset();
		},

		onCancelShipset: function (oEvent) {
			this.getModel("global").setProperty("/dontRefresh", false);
			this._closeDetail2View();
		},

		/**
		 * Toggle between full and non full screen mode.
		 */
		onToggleFullScreen: function () {
			var bFullScreen = this.getModel("appView").getProperty("/actionButtonsInfo/endColumn/fullScreen");
			this.getModel("appView").setProperty("/actionButtonsInfo/endColumn/fullScreen", !bFullScreen);
			if (!bFullScreen) {
				// store current layout and go full screen
				this.getModel("appView").setProperty("/previousLayout", this.getModel("appView").getProperty("/layout"));
				this.getModel("appView").setProperty("/layout", "EndColumnFullScreen");
			} else {
				// reset to previous layout
				this.getModel("appView").setProperty("/layout", this.getModel("appView").getProperty("/previousLayout"));
			}
		},

		/**
		 * Close third screen and navigate to second page
		 */
		onCloseDetailPress: function () {
			this.getModel("global").setProperty("/dontRefresh", true);
			this._closeDetail2View();
		},

		_closeDetail2View: function () {
			var bReplace = !Device.system.phone;
			this.getModel("appView").setProperty("/actionButtonsInfo/endColumn/fullScreen", false);
			// clear detail object
			this.getRouter().navTo("object", {
				SalesNo: this.sSalesNo
			}, bReplace);
		},

		onMoreOption: function () {
			this._getMoreOptions();
		},

		onMoreOptionClose: function () {
			if (this.oMoreOptionDialog.getContent()[0]) {
				var aControls = this.oMoreOptionDialog.getContent()[0].getContent();
				if (aControls.length > 0) {
					var sPath = this.getView().getBindingContext("global").getPath();
					var oObject = this.getView().getBindingContext("global").getObject();
					for (var i = 0; i < aControls.length; i++) {
						if (!(aControls[i] instanceof sap.m.Label || aControls[i] instanceof sap.ui.core.Title)) {
							// Update Saturday Delivery Indicator
							if (aControls[i].getId() === "SATURDAYDELIV") {
								oObject.Satdeliv = aControls[i].getSelected();
							} else if (aControls[i].getId() === "CARRIERRESID") {
								// Update Saturday Delivery Indicator
								oObject.Resident = aControls[i].getSelected();
							} else {
								this._getDataFromDynamicControl(aControls[i], oObject);
							}
						}
					}
					this.getModel("global").setProperty(sPath, oObject);
				}
			}
			this.oMoreOptionDialog.close();
		},

		onShowCarrierAnalysisDetail: function () {
			this._getCarrierAnalysis();
		},

		onCloseCarrierAnalysisDialog: function () {
			this.oCarrierAnalysisDialog.close();
		},

		onAfterCarrierAnalysisOpen: function () {
			var aAnalysis = this.getModel("global").getProperty("/CarrierAnalysisSet");
			try {
				this.getModel("global").setProperty("/CarrierAnalysis", this.treeify(aAnalysis, "NodeId", "ParentId"));
			} catch (exc) {
				this.getModel("global").setProperty("/CarrierAnalysis", []);
			}
		},

		onChangeCarrierAnalysisLine: function (oEvent) {
			if (oEvent.getParameter("rowContext")) {
				var oObject = oEvent.getParameter("rowContext").getObject();
				var oTitle = this.byId("txtTabDesc");
				if (oObject.Tabname === "" && oObject.Tabkey === "") {
					return;
				}
				oTitle.setText(oObject.NodeDesc);
				this.showBusy();
				this.analyRequest = this.getModel().callFunction("/GetConditionValue", {
					"method": "GET",
					urlParameters: {
						TabName: oObject.Tabname,
						TabKey: oObject.Tabkey,
						Sdata: oObject.Sdata
					},
					success: function (oData) {
						this.getModel("global").setProperty("/MessagesToFields", oData.results);
						this.hideBusy();
					}.bind(this),
					error: function (oError) {
						this._handleODataError(oError);
						this.getModel("global").setProperty("/MessagesToFields", []);
						this.hideBusy();
					}.bind(this)
				});
			}
		},

		onChangePrepaidIndicator: function (oEvent) {
			var bSelected = oEvent.getSource().getSelected();
			var oShipset = this.getView().getBindingContext("global").getObject();
			oShipset.ManupdP = !(this.bOriginalPrepaid === bSelected);
			var sPath = this.getView().getBindingContext("global").getPath();
			this.getModel("global").setProperty(sPath, oShipset);
		},

		on3PartyChange: function () {
			var oShipset = this.getView().getBindingContext("global").getObject();
			oShipset.ManupdA = !(this.sOriginal3Acc === oShipset.Tpacct && this.sOriginal3Zip === oShipset.Tpzip && this.sOriginal3Cnt ===
				oShipset.Tpctry);

			var sPath = this.getView().getBindingContext("global").getPath();
			this.getModel("global").setProperty(sPath, oShipset);
		},

		onAnalysisDataFound: function (oEvent) {
			var iCount = oEvent.getSource().getItems().length;
			oEvent.getSource().setVisible(iCount !== 0);
		},

		onMessagesFilter: function (oEvent) {
			var sValue = oEvent.getSource().getValue();
			var oAllFilter = new Filter([
				new Filter("Text1", sap.ui.model.FilterOperator.Contains, sValue),
				new Filter("Text2", sap.ui.model.FilterOperator.Contains, sValue),
				new Filter("Text3", sap.ui.model.FilterOperator.Contains, sValue)
			], false);
			this.byId("tabHdr").getBinding("items").filter([oAllFilter]);
		},

		onReset: function () {
			MessageBox.information(
				"Do you want to reset all shipsets or just the selected one?", {
					actions: ["All", "Selected", "Close"],
					onClose: function (sAction) {
						if (sAction === "All") {
							this._resetShipSet("A");
						} else if (sAction === "Selected") {
							this._resetShipSet("S");
						}
					}.bind(this)
				}
			);
		},
		/* =========================================================== */
		/* begin: internal methods                                     */
		/* =========================================================== */
		_saveShipset: function () {
			var oRequestData = this._generateShipSetUsecase();
			this.showBusy();
			this.getModel().create("/SalesOrderSet", oRequestData, {
				success: function (oData) {
					this.hideBusy();
					MessageToast.show(this.oBundle.getText("saveSOSuccess"));
					this.getModel("global").setProperty("/dontRefresh", false);

					// To store the new common flat sales order structure
					this._overwriteCommonSOFlatStructure(oData);

					this._closeDetail2View();
				}.bind(this),
				error: function (oError) {
					if (!this._handleODataError(oError)) {
						sap.ui.getCore().getEventBus().publish("REFRESH_PAGE", {});
					}
					this.hideBusy();
				}.bind(this)
			});
		},

		_generateShipSetUsecase: function () {
			var oData = {
				Vbeln: this.sSalesNo,
				ShipSetSet: this.getModel("global").getProperty("/ShipSetSet") || [],
				Action: "SaveSO",
				AddressOriginal: this.getModel("global").getProperty("/AddressOriginal")
			};
			this._addCommonSOFlatStructureToPayload(oData);

			return oData;
		},

		_changeCarrier: function (sCarrier) {
			var oServiceControl = this.byId("idServiceCombo");
			oServiceControl.getBinding("items").filter(new Filter("Scac", "EQ", sCarrier));
			this._getCarrierDetermination();
		},

		_getCarrierDetermination: function () {
			var oRequestData = this._generateCarrierDeterminationUsecase();
			this.showBusy();
			this.getModel().create("/SalesOrderSet", oRequestData, {
				success: function (oData) {
					// To store the new common flat sales order structure
					this._overwriteCommonSOFlatStructure(oData);
					this._updateShipsetDetermination(oData);
					this.hideBusy();
				}.bind(this),
				error: function (oError) {
					this._handleODataError(oError);
					this.hideBusy();
				}.bind(this)
			});
		},

		_generateCarrierDeterminationUsecase: function () {
			var oData = {
				Vbeln: this.sSalesNo,
				ShipSetSet: [this.getView().getBindingContext("global").getObject()],
				Action: "CarrierDetermination"
			};
			this._addCommonSOFlatStructureToPayload(oData);

			return oData;
		},

		_getServiceDetermination: function () {
			var oRequestData = this._generateServiceDeterminationUsecase();
			this.showBusy();
			this.getModel().create("/SalesOrderSet", oRequestData, {
				success: function (oData) {
					// To store the new common flat sales order structure
					this._overwriteCommonSOFlatStructure(oData);
					this._updateShipsetDetermination(oData);
					this.hideBusy();
				}.bind(this),
				error: function (oError) {
					this._handleODataError(oError);
					this.hideBusy();
				}.bind(this)
			});
		},

		_generateServiceDeterminationUsecase: function () {
			var oData = {
				Vbeln: this.sSalesNo,
				ShipSetSet: [this.getView().getBindingContext("global").getObject()],
				Action: "ServiceDetermination"
			};
			this._addCommonSOFlatStructureToPayload(oData);

			return oData;
		},

		_getBillOptDetermination: function () {
			var oRequestData = this._generateBillOptDeterminationUsecase();
			this.showBusy();
			this.getModel().create("/SalesOrderSet", oRequestData, {
				success: function (oData) {
					// To store the new common flat sales order structure
					this._overwriteCommonSOFlatStructure(oData);
					this._updateShipsetDetermination(oData);
					this.hideBusy();
				}.bind(this),
				error: function (oError) {
					this._handleODataError(oError);
					this.hideBusy();
				}.bind(this)
			});
		},

		_generateBillOptDeterminationUsecase: function () {
			var oData = {
				Vbeln: this.sSalesNo,
				ShipSetSet: [this.getView().getBindingContext("global").getObject()],
				Action: "BillOptionDetermination"
			};
			this._addCommonSOFlatStructureToPayload(oData);

			return oData;
		},

		_getInsuranceTypeDetermination: function () {
			var oRequestData = this._generateInsuranceTypeDeterminationUsecase();
			this.showBusy();
			this.getModel().create("/SalesOrderSet", oRequestData, {
				success: function (oData) {
					// To store the new common flat sales order structure
					this._overwriteCommonSOFlatStructure(oData);
					this._updateShipsetDetermination(oData);
					this.hideBusy();
				}.bind(this),
				error: function (oError) {
					this._handleODataError(oError);
					this.hideBusy();
				}.bind(this)
			});
		},

		_generateInsuranceTypeDeterminationUsecase: function () {
			var oData = {
				Vbeln: this.sSalesNo,
				ShipSetSet: [this.getView().getBindingContext("global").getObject()],
				Action: "InsuranceTypeDetermination"
			};
			this._addCommonSOFlatStructureToPayload(oData);

			return oData;
		},

		_getInsuranceValueDetermination: function () {
			var oRequestData = this._generateInsuranceValueDeterminationUsecase();
			this.showBusy();
			this.getModel().create("/SalesOrderSet", oRequestData, {
				success: function (oData) {
					// To store the new common flat sales order structure
					this._overwriteCommonSOFlatStructure(oData);
					this._updateShipsetDetermination(oData);
					this.hideBusy();
				}.bind(this),
				error: function (oError) {
					this._handleODataError(oError);
					this.hideBusy();
				}.bind(this)
			});
		},

		_generateInsuranceValueDeterminationUsecase: function () {
			var oData = {
				Vbeln: this.sSalesNo,
				ShipSetSet: [this.getView().getBindingContext("global").getObject()],
				Action: "InsuranceValueDetermination"
			};
			this._addCommonSOFlatStructureToPayload(oData);
			return oData;
		},

		_updateShipsetDetermination: function (oData) {
			if (oData.ShipSetSet) {
				if (oData.ShipSetSet.results.length > 0) {
					// Overwrite original Packing proposal active flag
					this._updateOriginalPackingProposalActive(oData);

					if (oData.ShipSetSet.results.length === 1) {
						var aOriginShipsetItem = this.getView().getBindingContext("global").getObject().ShipSetItemSet;
						var aOriginPackProposal = this.getView().getBindingContext("global").getObject().PackingProposalSet;
						var aOriginMoreOption = this.getView().getBindingContext("global").getObject().MoreOptionSet;
						var oShipset = oData.ShipSetSet.results[0];
						oShipset.ShipSetItemSet = aOriginShipsetItem;
						oShipset.PackingProposalSet = aOriginPackProposal;
						oShipset.MoreOptionSet = aOriginMoreOption;

						if (oShipset.Billoption === "3PRTY" || oShipset.Billoption === "COLL") {
							this.sOriginal3Acc = oShipset.Tpacct;
							this.sOriginal3Zip = oShipset.Tpzip;
							this.sOriginal3Cnt = oShipset.Tpctry;
						} else if (oShipset.Billoption === "PPAID") {
							this.bOriginalPrepaid = oShipset.Ppaidadd;
						}

						var sPath = this.getView().getBindingContext("global").getPath();
						this.getModel("global").setProperty(sPath, oShipset);

						this.byId("idServiceCombo").getBinding("items").filter(new Filter("Scac", "EQ", oShipset.Carrier));
					} else {
						var aShipset = this.getModel("global").getProperty("/ShipSetSet");
						for (var i = 0; i < oData.ShipSetSet.results.length; i++) {
							for (var j = 0; j < aShipset.length; j++) {
								if (aShipset[j].Counter === oData.ShipSetSet.results[i].Counter) {
									var aShipsetItem = aShipset[j].ShipSetItemSet;
									var aPackProposal = aShipset[j].PackingProposalSet;
									var aMoreOption = aShipset[j].MoreOptionSet;
									aShipset[j] = oData.ShipSetSet.results[i];
									aShipset[j].ShipSetItemSet = aShipsetItem;
									aShipset[j].PackingProposalSet = aPackProposal;
									aShipset[j].MoreOptionSet = aMoreOption;
									break;
								}
							}
						}
						this.getModel("global").setProperty("/ShipSetSet", aShipset);
						var sCarrier = this.getView().getBindingContext("global").getObject().Carrier;
						this.byId("idServiceCombo").getBinding("items").filter(new Filter("Scac", "EQ", sCarrier));
					}
				}
			}
		},

		_getMoreOptions: function () {
			if (this.oMoreOptionDialog) {
				this.oMoreOptionDialog.open();
			} else {
				var oRequestData = this._generateMoreOptionsUsecase();
				this.showBusy();
				this.getModel().create("/SalesOrderSet", oRequestData, {
					success: function (oData) {
						// Overwrite original Packing proposal active flag
						this._updateOriginalPackingProposalActive(oData);

						this.oMoreOptionDialog = Utils.getFragment(null, "MoreOptionsDialog", this);
						this.oMoreOptionDialog.destroyContent();
						this.hideBusy();
						// Generate More Options Forms
						this._generateMoreOptions(oData.ShipSetSet.results[0].MoreOptionSet.results);
						// Update More Option Items to be empty array
						for (var i = 0; i < oData.ShipSetSet.results[0].MoreOptionSet.results.length; i++) {
							if (oData.ShipSetSet.results[0].MoreOptionSet.results[i].MoreOptionItemSet === null) {
								oData.ShipSetSet.results[0].MoreOptionSet.results[i].MoreOptionItemSet = [];
							}
						}
						// Update current Shipset with the new MoreOptionSet
						var sPath = this.getView().getBindingContext("global").getPath();
						var oShipset = this.getView().getBindingContext("global").getObject();
						oShipset.MoreOptionSet = oData.ShipSetSet.results[0].MoreOptionSet.results;
						this.getModel("global").setProperty(sPath, oShipset);
						// Open dialog
						this.oMoreOptionDialog.open();
						this.hideBusy();
					}.bind(this),
					error: function (oError) {
						this._handleODataError(oError);
						this.hideBusy();
					}.bind(this)
				});
			}
		},

		_generateMoreOptionsUsecase: function () {
			var oShipset = this.getView().getBindingContext("global").getObject();
			oShipset.MoreOptionSet = [{
				MoreOptionItemSet: []
			}];
			var oData = {
				Vbeln: this.sSalesNo,
				Action: "GetMoreOptions",
				ShipSetSet: [oShipset]
			};
			this._addCommonSOFlatStructureToPayload(oData);
			return oData;
		},

		_generateMoreOptions: function (aOuputSample) {
			if (aOuputSample.length > 0) {
				var oMoreOptionForm = new SimpleForm({
					width: "auto",
					editable: true,
					layout: "ResponsiveGridLayout",
					labelSpanXL: 6,
					labelSpanL: 6,
					labelSpanM: 6,
					labelSpanS: 4,
					columnsXL: 4,
					columnsL: 4,
					columnsM: 3
				}).addStyleClass("border_lightgray sapUiSmallMarginBottom");
				var sFieldGroup = "";
				for (var i = 0; i < aOuputSample.length; i++) {
					if (aOuputSample[i].FieldGroup !== sFieldGroup && aOuputSample[i].Sequence === "01") {
						var oTitle = new sap.ui.core.Title({
							text: aOuputSample[i].GroupText
						});
						oMoreOptionForm.addContent(oTitle);
						sFieldGroup = aOuputSample[i].FieldGroup;
					}
					if (aOuputSample[i].CarrCode === "" || aOuputSample[i].FieldName === "") {
						continue;
					}
					var oLabel = new sap.m.Label({
						text: aOuputSample[i].FieldDesc,
						wrapping: false,
						tooltip: aOuputSample[i].FieldDesc
					});
					oMoreOptionForm.addContent(oLabel);
					var oInput;
					if (aOuputSample[i].FieldType === "01") {
						var bValue = false;
						if (aOuputSample[i].FieldValue === "") {
							bValue = false;
						} else if (aOuputSample[i].FieldValue === "true" || aOuputSample[i].FieldValue === "X") {
							bValue = true;
						} else if (aOuputSample[i].FieldValue === "false") {
							bValue = false;
						} else {
							bValue = false;
						}
						oInput = new sap.m.CheckBox({
							id: aOuputSample[i].FieldName,
							selected: bValue
						});
					} else if (aOuputSample[i].FieldType === "02") {
						oInput = new sap.m.ComboBox({
							id: aOuputSample[i].FieldName,
							selectedKey: aOuputSample[i].FieldValue
						});
						if (aOuputSample[i].MoreOptionItemSet.results.length > 0) {
							for (var j = 0; j < aOuputSample[i].MoreOptionItemSet.results.length; j++) {
								var oItem = new sap.ui.core.Item({
									key: aOuputSample[i].MoreOptionItemSet.results[j].Key,
									text: aOuputSample[i].MoreOptionItemSet.results[j].Value
								});
								oInput.addItem(oItem);
							}
						}
					} else if (aOuputSample[i].FieldType === "03") {
						oInput = new sap.m.Input({
							id: aOuputSample[i].FieldName,
							value: aOuputSample[i].FieldValue
						});
					} else if (aOuputSample[i].FieldType === "04") {
						var oDate1 = null,
							oDate2 = null;
						var sString = aOuputSample[i].FieldValue;
						if (sString.length === 8) {
							oDate1 = new Date(sString.slice(0, 4), parseInt(sString.slice(4, 6), 10) - 1, sString.slice(6));
						}
						sString = aOuputSample[i].FieldValue02;
						if (sString.length === 8) {
							oDate2 = new Date(sString.slice(0, 4), parseInt(sString.slice(4, 6), 10) - 1, sString.slice(6));
						}
						oInput = new sap.m.DateRangeSelection({
							id: aOuputSample[i].FieldName,
							displayFormat: "MM/dd/yyyy",
							dateValue: oDate1,
							secondDateValue: oDate2
						});
					} else if (aOuputSample[i].FieldType === "05") {
						oInput = new sap.m.DatePicker({
							id: aOuputSample[i].FieldName,
							value: aOuputSample[i].FieldValue,
							valueFormat: "yyyyMMdd",
							displayFormat: "MM/dd/yyyy"
						});
					} else if (aOuputSample[i].FieldType === "06") {
						oInput = new sap.m.RadioButton({
							id: aOuputSample[i].FieldName,
							selected: aOuputSample[i].FieldValue
						});
					} else if (aOuputSample[i].FieldType === "07") {
						oInput = new sap.m.TimePicker({
							id: aOuputSample[i].FieldName,
							value: aOuputSample[i].FieldValue,
							valueFormat: "HHmmss",
							displayFormat: "HH:mm"
						});
					} else {
						oInput = new sap.m.Input({
							id: aOuputSample[i].FieldName,
							value: aOuputSample[i].FieldValue
						});
					}

					// Disable or not
					if (aOuputSample[i].DisplayOption === "1" || aOuputSample[i].DisplayOption === "2") {
						if (aOuputSample[i].DisplayOption === "2") {
							oLabel.setRequired(true);
						} else {
							oLabel.setRequired(false);
						}
						oInput.setEnabled(true);
					} else {
						oInput.setEnabled(false);
					}
					oInput.setWidth("auto");
					oMoreOptionForm.addContent(oInput);
				}

				this.oMoreOptionDialog.addContent(oMoreOptionForm);
			}
		},

		_getDataFromDynamicControl: function (oControl, oSource) {
			var sFieldName = oControl.getId(),
				sValue1 = "",
				sValue2 = "";
			if (oControl instanceof sap.m.CheckBox) {
				sValue1 = oControl.getSelected() ? "X" : "";
			} else if (oControl instanceof sap.m.ComboBox) {
				sValue1 = oControl.getSelectedKey();
			} else if (oControl instanceof sap.m.Input) {
				sValue1 = oControl.getValue();
			} else if (oControl instanceof sap.m.DateRangeSelection) {
				var dateFormat = sap.ui.core.format.DateFormat.getDateInstance({
					pattern: "yyyyMMdd"
				});
				sValue1 = dateFormat.format(oControl.getDateValue());
				sValue2 = dateFormat.format(oControl.getSecondDateValue());
			} else if (oControl instanceof sap.m.DatePicker) {
				sValue1 = oControl.getValue();
			} else if (oControl instanceof sap.m.RadioButton) {
				sValue1 = oControl.getSelected();
			} else if (oControl instanceof sap.m.TimePicker) {
				sValue1 = oControl.getValue();
			}
			this._updateMoreOptionData(oSource, sFieldName, sValue1, sValue2);
		},

		_updateMoreOptionData: function (oSource, sFieldName, sValue1, sValue2) {
			if (!sFieldName) {
				return;
			}
			for (var i = 0; i < oSource.MoreOptionSet.length; i++) {
				if (oSource.MoreOptionSet[i].FieldName === sFieldName) {
					oSource.MoreOptionSet[i].FieldValue = sValue1;
					oSource.MoreOptionSet[i].FieldValue02 = sValue2;
					break;
				}
			}
		},

		_getCarrierAnalysis: function () {
			this.getModel("global").setProperty("/CarrierAnalysis", []);
			var oRequestData = this._generateCarrierAnalysisUsecase();
			this.showBusy();
			this.getModel().create("/SalesOrderSet", oRequestData, {
				success: function (oData) {
					if (oData.CarrierAnalysisSet !== null) {
						this.getModel("global").setProperty("/CarrierAnalysisSet", oData.CarrierAnalysisSet.results);
					} else {
						this.getModel("global").setProperty("/CarrierAnalysisSet", []);
					}

					this.oCarrierAnalysisDialog = Utils.getFragment(null, "CarrierAnalysisDialog", this);
					this.oCarrierAnalysisDialog.open();
					this.hideBusy();
				}.bind(this),
				error: function (oError) {
					this._handleODataError(oError);
					this.hideBusy();
				}.bind(this)
			});
		},

		_generateCarrierAnalysisUsecase: function () {
			var oObject = this.getView().getBindingContext("global").getObject();
			var oData = {
				Vbeln: this.sSalesNo,
				Action: "GetCarrierAnalysis",
				ShipSetSet: [oObject],
				CarrierAnalysisSet: []
			};
			this._addCommonSOFlatStructureToPayload(oData);
			return oData;
		},

		_resetShipSet: function (sCase) {
			var oRequestData = this._generateResetShipsetUsecase(sCase);
			this.showBusy();
			this.getModel().create("/SalesOrderSet", oRequestData, {
				success: function (oData) {
					this.oMoreOptionDialog = null;
					this._updateShipsetDetermination(oData);
					// To store the new common flat sales order structure
					this._overwriteCommonSOFlatStructure(oData);
					this.hideBusy();
				}.bind(this),
				error: function (oError) {
					this._handleODataError(oError);
					this.hideBusy();
				}.bind(this)
			});
		},

		_generateResetShipsetUsecase: function (sCase) {
			var oData = {};
			if (sCase === "S") {
				oData = {
					Vbeln: this.sSalesNo,
					ShipSetSet: [this.getView().getBindingContext("global").getObject()],
					Action: "ResetSelected"
				};
			} else {
				oData = {
					Vbeln: this.sSalesNo,
					ShipSetSet: this.getModel("global").getProperty("/ShipSetSet"),
					Action: "ResetAll"
				};
			}
			this._addCommonSOFlatStructureToPayload(oData);
			return oData;
		}
	});
});