import { ShopItem } from './ShopItem'

/**
 * Shop data management class for handling shop items
 * Simple UI data store - no persistence, just holds current items
 */
export class ShopData {
  private static instance: ShopData | null = null
  private items: Map<string, ShopItem> = new Map()

  private constructor() {
    // No loading - starts completely empty
  }

  /**
   * Get singleton instance
   */
  public static getInstance(): ShopData {
    if (!ShopData.instance) {
      ShopData.instance = new ShopData()
    }
    return ShopData.instance
  }

  /**
   * Add a new item to the shop
   */
  public addItem(item: ShopItem): void {
    this.items.set(item.id, { ...item })
    console.log(`🛒 Added shop item: ${item.title}`)
  }

  /**
   * Remove an item from the shop
   */
  public removeItem(itemId: string): void {
    if (this.items.delete(itemId)) {
      console.log(`🛒 Removed shop item: ${itemId}`)
    }
  }

  /**
   * Check if an item exists in the shop
   */
  public hasItem(itemId: string): boolean {
    return this.items.has(itemId)
  }

  /**
   * Get all shop items
   */
  public getAllItems(): ShopItem[] {
    return Array.from(this.items.values())
  }

  /**
   * Get a specific item by ID
   */
  public getItem(id: string): ShopItem | undefined {
    return this.items.get(id)
  }

  /**
   * Check if shop has any items
   */
  public hasItems(): boolean {
    return this.items.size > 0
  }

  /**
   * Clear all items from shop
   */
  public clear(): void {
    this.items.clear()
    console.log('🧹 Shop cleared')
  }

  /**
   * Get items by category
   */
  public getItemsByCategory(category: string): ShopItem[] {
    return Array.from(this.items.values()).filter(item => 
      item.category === category
    )
  }

  /**
   * Get featured items
   */
  public getFeaturedItems(): ShopItem[] {
    return Array.from(this.items.values()).filter(item => 
      item.featured
    )
  }
}
