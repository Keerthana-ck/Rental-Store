# Copyright (c) 2025, Keerthana and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document
from frappe.model.mapper import get_mapped_doc


class RentalItemMangement(Document):
    def before_save(self):
        if self.status == "Draft":
            self.status = "Issued"

@frappe.whitelist()
def make_balance_sales_invoice(source_name, target_doc=None):
    def set_missing_values(source, target):
        target.is_pos = 0
        target.due_date = frappe.utils.nowdate()
        target.items = []

        for rental_item in source.rental_items:
            row_amount = (
                (rental_item.qty or 0) * (rental_item.rent_rate or 0)
            )

            target.append("items", {
                "item_code": rental_item.item,
                "item_name": rental_item.item,
                "description": f"Balance for {rental_item.item}",
                "qty": rental_item.qty or 1,
                "rate": rental_item.rent_rate or 0,
                "amount": row_amount
            })

        target.custom_rental_reference = source.name

    mapping = {
        "Rental Item Mangement": {
            "doctype": "Sales Invoice",
            "field_map": {
                "customer": "customer",
                "company": "company"
            },
            "field_no_map": ["rental_items"]
        }
    }

    return get_mapped_doc("Rental Item Mangement", source_name, mapping, target_doc, set_missing_values)

@frappe.whitelist()
def get_damaged_rate(item_code):
    """Return damaged rate of a given item if available"""
    if not item_code:
        return None

    item_doc = frappe.get_doc("Item", item_code)
    if item_doc.custom_damaged_rate:
        return item_doc.custom_damaged_rate

    return 0
