sap.ui.define(["sap/ui/layout/form/SimpleForm",
	"com/erpis/shiperp/hr7/quickpackewm/common/ControlUtils",
	"com/erpis/shiperp/hr7/quickpackewm/common/Utils"
], function (SimpleForm, ControlUtils, Utils) {
	"use strict";
	return {
		/**Render dynamic fields for more option view package level
		 * */
		renderPackageLevelForm: function (aSourceFields, oController, bDeep) {
			if (aSourceFields.length > 0) {
				var oDataOld = aSourceFields;
				var oMoreOptionForm = this.renderFormContent(aSourceFields, oController, bDeep, false, oDataOld);
				oController.oPackageLevelOptionsDialog.addContent(oMoreOptionForm);
			}
		},
		/**
		 * render form for shipment level
		 **/
		renderForm: function (aSourceFields, oController, bDeep) {
			if (aSourceFields.length > 0) {
				var oDataOld = aSourceFields;
				var oForm = this.renderFormContent(aSourceFields, oController, bDeep, true, oDataOld);
				oController.Control.addBlock(oForm);
			}
		},

		/**
		 * @param: bShipment - true is for shipment level; false for package level
		 * */
		renderFormContent: function (aOriginalSourceFields, oController, bDeep, bShipment, oDataOld) {
			oController.aTable = [];
			var aSourceFields = Utils._getExistItemsArray(aOriginalSourceFields, "fieldPName", "");
			this.bcheckTableMoreOption = false;
			//check deep items
			if (bDeep === true) {
				aSourceFields = aOriginalSourceFields;
			}
			if (aSourceFields.length > 0) {
				var oForm = new SimpleForm({
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
				for (var i = 0; i < aSourceFields.length; i++) {
					if (aSourceFields[i].fieldGroup !== sFieldGroup && aSourceFields[i].sequence === "01" || aSourceFields[i].fieldGroup !==
						sFieldGroup && aSourceFields[i].sequence === "001") {
						var oTitle = new sap.ui.core.Title({
							text: aSourceFields[i].groupText
						});
						oForm.addContent(oTitle);
						sFieldGroup = aSourceFields[i].fieldGroup;
					}
					if (aSourceFields[i].carrCode === "" || aSourceFields[i].fieldName === "") {
						continue;
					}
					var oLabel = ControlUtils.Label(aSourceFields[i].fieldDesc);
					if (aSourceFields[i].fieldType !== "08") {
						oForm.addContent(oLabel);
					}

					//Build dynamic fields
					var thisInstance = this;
					var oSourceField = Object.assign({}, aSourceFields[i]);
					oSourceField.ComboboxValues = (aSourceFields[i].valueList) ? aSourceFields[i].valueList.results : []; //set data for combobox
					//Add event for checkbox if FieldValue2 not null
					if (aSourceFields[i].fieldType === "02" && aSourceFields[i].fieldValue !== "") {
						//add checkbox event to enable disable button
					}
					//Field type button event handler
					if (aSourceFields[i].fieldType === "08") {
						oSourceField.FnCallback = function (data) {
							var aDeepFields;
							var oMoreOptionChild;
							if (aOriginalSourceFields.length === oDataOld.length) {
								aDeepFields = Utils._getExistItemsArray(aOriginalSourceFields, "fieldPName", data.key);
								if (aDeepFields.length > 0) {
									thisInstance.isShipment = bShipment;
									oMoreOptionChild = thisInstance.renderFormContent(aDeepFields, oController, true, bShipment);
									thisInstance.renderDialog(oMoreOptionChild, data.key, data.text, oController, thisInstance);
								}
							} else {
								aDeepFields = Utils._getExistItemsArray(oDataOld, "fieldPName", data.key);
								if (aDeepFields.length > 0) {
									thisInstance.isShipment = bShipment;
									oMoreOptionChild = thisInstance.renderFormContent(aDeepFields, oController, true, bShipment);
									thisInstance.renderDialog(oMoreOptionChild, data.key, data.text, oController, thisInstance);
								}
							}

						};
					}
					if (aSourceFields[i].fieldType !== "10") {
						var skeyCountry = oController.getModel("local").getProperty("/basic/partners/shipFrom/addr/Land1");
						var oFieldBase = ControlUtils.BuildControlByType(oSourceField, oController, skeyCountry);
						// Disable option before add to content
						if (aSourceFields[i].displayOption === "1" || aSourceFields[i].displayOption === "2") {
							if (aSourceFields[i].displayOption === "2") {
								oLabel.setRequired(true);
							} else {
								oLabel.setRequired(false);
							}
							if (aSourceFields[i].fieldType === "08") {
								oFieldBase.setVisible(true);
							} else {
								oFieldBase.setEnabled(false);
							}
						} else {
							//Axo 6913
							oFieldBase.setEnabled(false);
						}
						//Axo 4770
						if (oController.isCanShip === false) {
							oFieldBase.setEnabled(false);
						}
						oFieldBase.setWidth("auto");
						oForm.addContent(oFieldBase);
					}
				} //end loop
				return oForm; // return the VBox instead of the SimpleForm
			}
			return null;
		},

		renderDialog: function (oContent, deepId, sTitle, oController, oDynamicInstance) {
			//remove old dialog to avoid duplicate
			if (oController._deepFormDialog) {
				oController._deepFormDialog.destroy();
				oController._deepFormDialog = null;
			}
			//create new dialog
			oController._deepFormDialog = new sap.m.Dialog({
				id: deepId,
				title: sTitle,
				content: oContent,
				state: "Success",
				stretch: true,
				endButton: new sap.m.Button({
					text: "Close",
					press: function () {
						if (oController._deepFormDialog.getContent()[0]) {
							oDynamicInstance.getDynamicDialog(oController._deepFormDialog, oController, oDynamicInstance, false);
						}
						oController._deepFormDialog.close();
						oController._deepFormDialog.destroy();
					}
				})
			});
			oController.getView().addDependent(oController._deepFormDialog);
			oController._deepFormDialog.open();

		},
		//get dynamic data for package level
		getDynamicDialog: function (oDialogInstance, oController, oDynamicInstance, isDeep) {

			if (oDialogInstance === null) {
				return;
			}
			var aControls;
			if (oDialogInstance.getContent()[0]) {
				if (oDialogInstance.getContent()[0] instanceof sap.m.FlexBox) {
					aControls = oDialogInstance.getContent()[0].getItems()[0].getContent();
				} else {
					aControls = oDialogInstance.getContent()[0].getContent();
				}
				if (aControls.length > 0) {
					if (!oDynamicInstance.isShipment) {
						//for package level
						if (!oController.currentFUPath) {
							return;
						}
						var oFreightUnitItemRow = oController.getModel("local").getProperty(oController.currentFUPath);
						for (var i = 0; i < aControls.length; i++) {
							if (!(aControls[i] instanceof sap.m.Button || aControls[i] instanceof sap.m.Label || aControls[i] instanceof sap.ui.core.Title)) {
								oDynamicInstance._getDynamicControl(aControls[i], oFreightUnitItemRow, "PACKAGE");
							}
						}

						oController.getModel("local").setProperty(oController.currentFUPath, oFreightUnitItemRow);
					} else {
						//for shipment level
						var oShipmentCarrierOptions = oController.getModel("local").getProperty("/ShipmentCarrierOptions");
						for (var s = 0; s < aControls.length; s++) {
							if (!(aControls[s] instanceof sap.m.Button || aControls[s] instanceof sap.m.Label || aControls[s] instanceof sap.ui.core.Title)) {
								oDynamicInstance._getDynamicControl(aControls[s], oShipmentCarrierOptions, "SHIPMENT");
							}
						}
						oController.getModel("local").setProperty("/ShipmentCarrierOptions", oShipmentCarrierOptions);
					}
				}
			}
		},

		//get dynamic data for Package level
		getDynamicPackageLevelForm: function (oForm, oController, oDynamicInstance) {
			if (oForm.getContent().length > 0) {
				if (oForm.getContent()[0]) {
					var aControls = oForm.getContent();
					if (aControls.length > 0) {
						var oShipmentCarrierOptions = oController.getModel("local").getProperty("/ShipmentCarrierOptions");
						for (var i = 0; i < aControls.length; i++) {
							if (!(aControls[i] instanceof sap.m.Button || aControls[i] instanceof sap.m.Label || aControls[i] instanceof sap.ui.core.Title)) {
								oDynamicInstance._getDynamicControl(aControls[i], oShipmentCarrierOptions, "SHIPMENT");
							}
						}

						oController.getModel("local").setProperty("/ShipmentCarrierOptions", oShipmentCarrierOptions);
					}
				}
			}

		},

		_getDynamicControl: function (oControl, oSource, sLevel) {
			var sFieldName = oControl.getId(),
				sValue1 = "",
				sValue2 = "";
			//remove prefix
			sFieldName = sFieldName.replaceAll("PACKAGE_", "").replaceAll("SHIPMENT_", "");

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
			this._updateMoreOptionData(oSource, sFieldName, sValue1, sValue2, sLevel);
		},
		_updateMoreOptionData: function (oSource, sFieldName, sValue1, sValue2, sLevel) {
			if (!sFieldName) {
				return;
			}
			//process for package
			if (sLevel === "PACKAGE") {
				for (var i = 0; i < oSource.packageLevelOption.results.length; i++) {
					var packageFieldName = oSource.packageLevelOption.results[i].fieldName;
					packageFieldName = packageFieldName.replaceAll("PACKAGE_", "").replaceAll("SHIPMENT_", "");
					if (packageFieldName === sFieldName) {
						oSource.packageLevelOption.results[i].fieldValue = sValue1;
						// oSource.carrierMoreOptions.results[i].fieldValue = sValue2;
						break;
					}
				}

			}

			//process for shipment
			if (sLevel === "SHIPMENT") {
				for (var s = 0; s < oSource.length; s++) {
					var shipmentFieldName = oSource[s].fieldName;
					shipmentFieldName = shipmentFieldName.replaceAll("PACKAGE_", "").replaceAll("SHIPMENT_", "");
					if (shipmentFieldName === sFieldName) {
						oSource[s].fieldValue = sValue1;
						// oSource[s].fieldValue = sValue2;
						break;
					}
				}
			}
		},

		removePrefixBeforeExecute: function (aSources) {
			aSources.forEach(function (item) {
				item.fieldName = item.fieldName.replaceAll("PACKAGE_", "").replaceAll("SHIPMENT_", "");
			});
			return aSources;
		},

		removePrefixShipment: function (oController) {
			var aShipmentCarrierOptions = oController.getModel("local").getProperty("/ShipmentCarrierOptions");
			aShipmentCarrierOptions = this.removePrefixBeforeExecute(aShipmentCarrierOptions);
			oController.getModel("local").setProperty("/ShipmentCarrierOptions", aShipmentCarrierOptions);

		},
	};
});