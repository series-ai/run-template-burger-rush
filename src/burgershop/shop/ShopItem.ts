/**
 * Shop item data structures and interfaces for premium currency purchases
 * 
 * Example usage for other systems to add purchasable items:
 * 
 * ```typescript
 * const shopSystem = ShopSystem.getInstance()
 * 
 * // Add an item purchasable with premium currency
 * shopSystem.addItem({
 *   id: 'speed_boost',
 *   title: '2x Speed Boost',
 *   description: 'Double your speed for 1 hour',
 *   price: 25,
 *   currency: '💎',
 *   category: 'boosts',
 *   purchased: false,
 *   onPurchaseSuccess: () => {
 *     // Called after successful premium currency payment
 *     // Shop system handles currency deduction automatically
 *     PlayerSystem.applySpeedBoost(3600)
 *   }
 * })
 * ```
 */

/**
 * Result of a purchase attempt
 */
export interface PurchaseResult {
  success: boolean
  error?: string // Error message if purchase failed
  removePurchaseOnSuccess?: boolean // Whether to automatically remove item from shop after successful purchase
}

export interface ShopItem {
  id: string
  title: string
  description: string
  price: number // Premium currency price
  currency: string // Currency symbol (e.g., "💎")
  canvasContent?: ShopItemCanvasContent
  category: ShopItemCategory
  purchased: boolean
  featured?: boolean // For highlighting special offers
  onPurchaseSuccess: () => Promise<void> | void // Called after successful premium currency payment (shop handles currency deduction)
}

export interface ShopItemCanvasContent {
  type: 'image' | 'text' | 'animation' | 'custom'
  content: string // URL for image, text content, or custom HTML
  backgroundColor?: string
  textColor?: string
}

export type ShopItemCategory = 'currency' | 'boosts' | 'cosmetics' | 'special'

/**
 * Sample shop items for testing the system
 */
export const SAMPLE_SHOP_ITEMS: ShopItem[] = [
  {
    id: 'premium_currency_small',
    title: '500 Gems',
    description: 'Small gem package for quick purchases',
    price: 5,
    currency: '💎',
    category: 'currency',
    purchased: false,
    canvasContent: {
      type: 'text',
      content: '💎\n500',
      backgroundColor: '#4ade80',
      textColor: '#ffffff'
    },
    onPurchaseSuccess: () => {
      console.log('💎 Would add 500 gems to player inventory')
    }
  },
  {
    id: 'premium_currency_medium',
    title: '1200 Gems',
    description: 'Popular choice! 20% bonus gems included',
    price: 10,
    currency: '💎',
    category: 'currency',
    purchased: false,
    featured: true,
    canvasContent: {
      type: 'text',
      content: '💎\n1200\n+20%',
      backgroundColor: '#8b5cf6',
      textColor: '#ffffff'
    },
    onPurchaseSuccess: () => {
      console.log('💎 Would add 1200 gems to player inventory')
    }
  },
  {
    id: 'premium_currency_large',
    title: '3000 Gems',
    description: 'Best value! 50% bonus gems included',
    price: 20,
    currency: '💎',
    category: 'currency',
    purchased: false,
    canvasContent: {
      type: 'text',
      content: '💎\n3000\n+50%',
      backgroundColor: '#f59e0b',
      textColor: '#ffffff'
    },
    onPurchaseSuccess: () => {
      console.log('💎 Would add 3000 gems to player inventory')
    }
  },
  {
    id: 'speed_boost',
    title: '2x Speed Boost',
    description: 'Double your movement and cooking speed for 1 hour',
    price: 15,
    currency: '💎',
    category: 'boosts',
    purchased: false,
    canvasContent: {
      type: 'text',
      content: '⚡\n2x\nSpeed',
      backgroundColor: '#ef4444',
      textColor: '#ffffff'
    },
    onPurchaseSuccess: () => {
      console.log('⚡ Would apply speed boost to player for 1 hour')
    }
  },
  {
    id: 'money_multiplier',
    title: '3x Earnings',
    description: 'Triple your money earnings for 30 minutes',
    price: 25,
    currency: '💎',
    category: 'boosts',
    purchased: false,
    canvasContent: {
      type: 'text',
      content: '💰\n3x\nEarnings',
      backgroundColor: '#22c55e',
      textColor: '#ffffff'
    },
    onPurchaseSuccess: () => {
      console.log('💰 Would apply 3x earnings multiplier for 30 minutes')
    }
  },
  {
    id: 'golden_uniform',
    title: 'Golden Uniform',
    description: 'Exclusive golden chef outfit with special effects',
    price: 50,
    currency: '💎',
    category: 'cosmetics',
    purchased: false,
    canvasContent: {
      type: 'text',
      content: '👑\nGolden\nUniform',
      backgroundColor: '#fbbf24',
      textColor: '#ffffff'
    },
    onPurchaseSuccess: () => {
      console.log('👑 Would unlock golden uniform cosmetic')
    }
  }
]
