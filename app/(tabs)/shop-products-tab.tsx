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
import { Ionicons, FontAwesome5 } from '@expo/vector-icons';
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

interface ShopProductsTabProps {
  search: string;
  onSearch: (query: string) => void;
}

export function ShopProductsTab({ search, onSearch }: ShopProductsTabProps) {
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [wishlist, setWishlist] = useState(new Set<string>());

  const filteredProducts = useMemo(() => {
    return PRODUCTS.filter(product =>
      (selectedCategory === 'All' || product.brand.toLowerCase().includes(selectedCategory.toLowerCase()) || product.title.toLowerCase().includes(selectedCategory.toLowerCase())) &&
      (search === '' || product.title.toLowerCase().includes(search.toLowerCase()) || product.brand.toLowerCase().includes(search.toLowerCase()))
    );
  }, [search, selectedCategory]);

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

      <View style={styles.cardContent}>
        <View style={styles.brandRatingRow}>
          <Text style={styles.brand}>{item.brand}</Text>
          <View style={styles.ratingContainer}>
            <FontAwesome5 name="star" size={10} color="#F59E0B" solid />
            <Text style={styles.rating}>{item.rating}</Text>
            <Text style={styles.reviewCount}>({item.reviews})</Text>
          </View>
        </View>

        <Text style={styles.productTitle} numberOfLines={2}>
          {item.title}
        </Text>

        <Text style={styles.partNumber}>PN: {item.partNumber}</Text>

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
  );
}

const styles = StyleSheet.create({
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
