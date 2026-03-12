import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  Pressable,
  FlatList,
  Dimensions,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons, FontAwesome5, MaterialCommunityIcons } from '@expo/vector-icons';

const { width } = Dimensions.get('window');

// UX Pilot Colors (Exact from design)
const COLORS = {
  dark: '#687494',      // Background
  card: '#5C6784',      // Card background
  accent: '#FF7B47',    // Orange accent
  text: '#FFFFFF',      // Text
  muted: '#E5E7EB',     // Muted text
  border: '#4A5568',    // Borders
};

interface Product {
  id: string;
  title: string;
  brand: string;
  partNumber: string;
  price: string;
  rating: number;
  reviews: number;
  image: string;
  stockStatus: 'in-stock' | 'low-stock' | 'out-of-stock';
  stockCount?: number;
  condition: 'new' | 'refurbished' | 'used';
}

const PRODUCTS: Product[] = [
  {
    id: '1',
    title: 'Fluke 101 Digital Multimeter Pocket Size',
    brand: 'Fluke',
    partNumber: 'FLK-101',
    price: '$45.00',
    rating: 4.9,
    reviews: 128,
    image: 'https://storage.googleapis.com/uxpilot-auth.appspot.com/9aceedb33f-609b1ccccf959a401159.png',
    stockStatus: 'in-stock',
    stockCount: 12,
    condition: 'new',
  },
  {
    id: '2',
    title: 'FX-888D Digital Soldering Station',
    brand: 'Hakko',
    partNumber: 'FX888D-23BY',
    price: '$89.99',
    rating: 4.8,
    reviews: 84,
    image: 'https://storage.googleapis.com/uxpilot-auth.appspot.com/87f7d0661b-f644e08848019f289073.png',
    stockStatus: 'in-stock',
    stockCount: 4,
    condition: 'refurbished',
  },
  {
    id: '3',
    title: '7X-45X Trinocular Stereo Zoom Microscope',
    brand: 'AmScope',
    partNumber: 'SM-4TP',
    price: '$420.00',
    rating: 4.7,
    reviews: 215,
    image: 'https://images.unsplash.com/photo-1590845947698-8924d7409b56?ixlib=rb-4.0.3&auto=format&fit=crop&w=500&q=80',
    stockStatus: 'low-stock',
    stockCount: 2,
    condition: 'new',
  },
  {
    id: '4',
    title: 'iPhone 13 Pro Max Logic Board 256GB Unlocked',
    brand: 'OEM',
    partNumber: '820-02382',
    price: '$250.00',
    rating: 4.5,
    reviews: 12,
    image: 'https://images.unsplash.com/photo-1517404215738-15263e9f9178?ixlib=rb-4.0.3&auto=format&fit=crop&w=500&q=80',
    stockStatus: 'out-of-stock',
    condition: 'used',
  },
];

const conditionColors: Record<string, string> = {
  new: '#10B981',
  refurbished: '#3B82F6',
  used: '#6B7280',
};

interface ShopProductsTabProps {
  search: string;
  onSearch: (query: string) => void;
}

export function ShopProductsTab({ search, onSearch }: ShopProductsTabProps) {
  const [wishlist, setWishlist] = useState(new Set<string>());

  const filteredProducts = useMemo(() => {
    return PRODUCTS.filter(product =>
      product.title.toLowerCase().includes(search.toLowerCase()) ||
      product.brand.toLowerCase().includes(search.toLowerCase()) ||
      product.partNumber.toLowerCase().includes(search.toLowerCase())
    );
  }, [search]);

  const toggleWishlist = (id: string) => {
    const newWishlist = new Set(wishlist);
    if (newWishlist.has(id)) {
      newWishlist.delete(id);
    } else {
      newWishlist.add(id);
    }
    setWishlist(newWishlist);
  };

  const renderProductCard = ({ item }: { item: Product }) => (
    <Pressable style={styles.productCard}>
      {/* Wishlist Button */}
      <Pressable
        onPress={() => toggleWishlist(item.id)}
        style={styles.wishlistBtn}
      >
        <Ionicons
          name={wishlist.has(item.id) ? 'heart' : 'heart-outline'}
          size={16}
          color={wishlist.has(item.id) ? '#FF3B30' : COLORS.text}
        />
      </Pressable>

      {/* Product Image Container */}
      <View style={styles.imageContainer}>
        <Image
          source={{ uri: item.image }}
          style={styles.productImage}
          contentFit="cover"
          cachePolicy="memory-disk"
        />
        {/* Condition Badge */}
        <View
          style={[
            styles.conditionBadge,
            { backgroundColor: conditionColors[item.condition] },
          ]}
        >
          <Text style={styles.conditionBadgeText}>
            {item.condition.toUpperCase()}
          </Text>
        </View>
      </View>

      {/* Card Content */}
      <View style={styles.cardContent}>
        {/* Brand & Rating Row */}
        <View style={styles.brandRatingRow}>
          <Text style={styles.brand}>{item.brand}</Text>
          <View style={styles.ratingContainer}>
            <Ionicons name="star" size={10} color="#FCD34D" />
            <Text style={styles.rating}>{item.rating}</Text>
            <Text style={styles.reviewCount}>({item.reviews})</Text>
          </View>
        </View>

        {/* Product Title */}
        <Text style={styles.productTitle} numberOfLines={2}>
          {item.title}
        </Text>

        {/* Part Number */}
        <Text style={styles.partNumber}>PN: {item.partNumber}</Text>

        {/* Price & Stock Row */}
        <View style={styles.priceStockRow}>
          <View>
            <Text style={styles.price}>{item.price}</Text>
            <Text
              style={[
                styles.stockInfo,
                {
                  color:
                    item.stockStatus === 'in-stock'
                      ? '#10B981'
                      : item.stockStatus === 'low-stock'
                        ? '#FCD34D'
                        : '#EF4444',
                },
              ]}
            >
              {item.stockStatus === 'in-stock'
                ? `✓ In Stock (${item.stockCount})`
                : item.stockStatus === 'low-stock'
                  ? `⚠ Low Stock (${item.stockCount})`
                  : '✕ Out of Stock'}
            </Text>
          </View>

          {/* Cart Button */}
          <Pressable
            style={[
              styles.cartBtn,
              {
                backgroundColor:
                  item.stockStatus === 'out-of-stock'
                    ? COLORS.border
                    : COLORS.accent,
              },
            ]}
          >
            <MaterialCommunityIcons
              name={
                item.stockStatus === 'out-of-stock'
                  ? 'bell-outline'
                  : 'cart-plus'
              }
              size={16}
              color={COLORS.text}
            />
          </Pressable>
        </View>
      </View>
    </Pressable>
  );

  return (
    <View style={styles.container}>
      {/* Header Section */}
      <View style={styles.headerSection}>
        <View>
          <Text style={styles.headerTitle}>Professional Tools & Parts</Text>
          <Text style={styles.headerSubtitle}>
            {filteredProducts.length} items found
          </Text>
        </View>
      </View>

      {/* Product Grid */}
      <FlatList
        data={filteredProducts}
        renderItem={renderProductCard}
        keyExtractor={(item) => item.id}
        numColumns={2}
        columnWrapperStyle={styles.gridRow}
        contentContainerStyle={styles.gridContent}
        scrollEnabled={false}
        ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.dark,
  },
  headerSection: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 12,
    color: COLORS.muted,
  },
  gridContent: {
    padding: 12,
  },
  gridRow: {
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 12,
  },
  productCard: {
    flex: 1,
    backgroundColor: COLORS.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: 'hidden',
    maxWidth: '48%',
  },
  wishlistBtn: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(104, 116, 148, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  imageContainer: {
    aspectRatio: 1,
    backgroundColor: '#F5F5F5',
    position: 'relative',
    overflow: 'hidden',
  },
  productImage: {
    width: '100%',
    height: '100%',
  },
  conditionBadge: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  conditionBadgeText: {
    fontSize: 8,
    fontWeight: '700',
    color: '#FFF',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  cardContent: {
    padding: 12,
    gap: 6,
  },
  brandRatingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  brand: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.muted,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  rating: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.text,
  },
  reviewCount: {
    fontSize: 10,
    color: COLORS.muted,
  },
  productTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.text,
    lineHeight: 16,
  },
  partNumber: {
    fontSize: 10,
    color: COLORS.muted,
    fontFamily: 'monospace',
  },
  priceStockRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginTop: 6,
  },
  price: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.accent,
    marginBottom: 2,
  },
  stockInfo: {
    fontSize: 10,
    fontWeight: '500',
  },
  cartBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
