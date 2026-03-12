import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  Pressable,
  FlatList,
  Image as RNImage,
  Dimensions,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons, FontAwesome5 } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { T } from '@/constants/techTheme';

const { width } = Dimensions.get('window');

interface Product {
  id: string;
  title: string;
  brand: string;
  partNumber: string;
  price: string;
  rating: number;
  reviews: number;
  image: string;
  stockStatus: 'in-stock' | 'low-stock' | 'out-of-stock' | 'notify';
  stockCount?: number;
  condition: 'new' | 'refurbished' | 'used';
  liked?: boolean;
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

const CATEGORIES = ['All', 'Tools', 'Parts', 'Soldering', 'Multimeter', 'Electronics'];

export default function ShopScreen() {
  const insets = useSafeAreaInsets();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [wishlist, setWishlist] = useState(new Set<string>());
  const [activeFilters, setActiveFilters] = useState({
    vehicle: 'All Vehicles',
    condition: 'All Conditions',
    price: 'All Prices',
  });

  const filteredProducts = useMemo(() => {
    return PRODUCTS.filter(product =>
      (selectedCategory === 'All' || product.brand.toLowerCase().includes(selectedCategory.toLowerCase()) || product.title.toLowerCase().includes(selectedCategory.toLowerCase())) &&
      (searchQuery === '' || product.title.toLowerCase().includes(searchQuery.toLowerCase()) || product.brand.toLowerCase().includes(searchQuery.toLowerCase()))
    );
  }, [searchQuery, selectedCategory]);

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
      {/* Heart/Wishlist Button */}
      <Pressable
        onPress={() => toggleWishlist(item.id)}
        style={styles.wishlistBtn}
      >
        <Ionicons
          name={wishlist.has(item.id) ? 'heart' : 'heart-outline'}
          size={20}
          color={wishlist.has(item.id) ? '#FF6B2C' : T.text}
        />
      </Pressable>

      {/* Product Image */}
      <View style={styles.imageContainer}>
        <Image
          source={{ uri: item.image }}
          style={styles.productImage}
          contentFit="cover"
          cachePolicy="memory-disk"
        />
        <View style={[
          styles.conditionBadge,
          {
            backgroundColor:
              item.condition === 'new'
                ? '#10B981'
                : item.condition === 'refurbished'
                  ? '#3B82F6'
                  : '#6B7280',
          },
        ]}>
          <Text style={styles.conditionBadgeText}>
            {item.condition.charAt(0).toUpperCase() + item.condition.slice(1)}
          </Text>
        </View>
      </View>

      {/* Product Info */}
      <View style={styles.cardContent}>
        {/* Brand and Rating Row */}
        <View style={styles.brandRatingRow}>
          <Text style={styles.brand}>{item.brand}</Text>
          <View style={styles.ratingContainer}>
            <FontAwesome5 name="star" size={10} color="#F59E0B" solid />
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

        {/* Price and Stock Info */}
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
                        ? '#F59E0B'
                        : '#EF4444',
                },
              ]}
            >
              {item.stockStatus === 'in-stock'
                ? `✓ In Stock (${item.stockCount})`
                : item.stockStatus === 'low-stock'
                  ? `⚠ Low Stock (${item.stockCount})`
                  : item.stockStatus === 'out-of-stock'
                    ? '✕ Out of Stock'
                    : '🔔 Notify Me'}
            </Text>
          </View>

          {/* Add to Cart / Notify Button */}
          <Pressable
            style={[
              styles.cartBtn,
              {
                backgroundColor:
                  item.stockStatus === 'out-of-stock' ? T.border : T.accent,
              },
            ]}
          >
            <Ionicons
              name={
                item.stockStatus === 'out-of-stock' ? 'notifications-outline' : 'add-circle'
              }
              size={20}
              color={T.text}
            />
          </Pressable>
        </View>
      </View>
    </Pressable>
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>
          Mobi <Text style={styles.headerAccent}>Products</Text>
        </Text>

        {/* Search Bar */}
        <View style={styles.searchContainer}>
          <Ionicons name="search" size={18} color={T.muted} style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search spare parts, tools..."
            placeholderTextColor={T.muted}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          <Pressable style={styles.searchBtn}>
            <Ionicons name="arrow-forward" size={16} color={T.text} />
          </Pressable>
        </View>
      </View>

      {/* Filter Bar */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterBar}
        contentContainerStyle={styles.filterBarContent}
      >
        {['Vehicle', 'Condition', 'Price', 'Sort'].map((filter) => (
          <Pressable key={filter} style={styles.filterChip}>
            <Ionicons
              name={
                filter === 'Vehicle'
                  ? 'car'
                  : filter === 'Condition'
                    ? 'pricetag'
                    : filter === 'Price'
                      ? 'cash'
                      : 'swap-vertical'
              }
              size={14}
              color={T.muted}
            />
            <Text style={styles.filterChipText}>{filter}</Text>
            {filter !== 'Sort' && (
              <Ionicons name="chevron-down" size={12} color={T.muted} />
            )}
          </Pressable>
        ))}
      </ScrollView>

      {/* Product Grid */}
      <FlatList
        data={filteredProducts}
        renderItem={renderProductCard}
        keyExtractor={(item) => item.id}
        numColumns={2}
        columnWrapperStyle={styles.gridRow}
        contentContainerStyle={styles.gridContent}
        scrollEnabled={false}
        ListHeaderComponent={
          <View style={styles.gridHeader}>
            <View>
              <Text style={styles.gridTitle}>Professional Tools & Parts</Text>
              <Text style={styles.gridSubtitle}>{filteredProducts.length} items found</Text>
            </View>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: T.bg,
  },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: T.border,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: T.text,
    marginBottom: 12,
  },
  headerAccent: {
    color: T.accent,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: T.card,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: T.border,
    paddingHorizontal: 12,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 10,
    fontSize: 14,
    color: T.text,
  },
  searchBtn: {
    padding: 8,
    backgroundColor: T.accent,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  filterBar: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: T.border,
  },
  filterBarContent: {
    gap: 8,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: T.card,
    borderWidth: 1,
    borderColor: T.border,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  filterChipText: {
    fontSize: 13,
    fontWeight: '500',
    color: T.text,
  },
  gridContent: {
    padding: 12,
  },
  gridHeader: {
    marginBottom: 16,
  },
  gridTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: T.text,
    marginBottom: 4,
  },
  gridSubtitle: {
    fontSize: 12,
    color: T.muted,
  },
  gridRow: {
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 12,
  },
  productCard: {
    flex: 1,
    backgroundColor: T.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: T.border,
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
    backgroundColor: 'rgba(18,18,18,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  imageContainer: {
    aspectRatio: 1,
    backgroundColor: '#F5F5F5',
    position: 'relative',
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
    fontSize: 9,
    fontWeight: '700',
    color: '#FFF',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  cardContent: {
    padding: 12,
  },
  brandRatingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 6,
  },
  brand: {
    fontSize: 11,
    fontWeight: '600',
    color: T.muted,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  rating: {
    fontSize: 11,
    fontWeight: '600',
    color: T.text,
  },
  reviewCount: {
    fontSize: 10,
    color: T.muted,
  },
  productTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: T.text,
    marginBottom: 4,
  },
  partNumber: {
    fontSize: 10,
    color: T.muted,
    fontFamily: 'monospace',
    marginBottom: 8,
  },
  priceStockRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginTop: 'auto',
  },
  price: {
    fontSize: 16,
    fontWeight: '700',
    color: T.accent,
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
